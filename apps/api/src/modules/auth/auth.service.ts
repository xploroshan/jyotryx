import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  SendOtpDto,
  VerifyOtpDto,
  GoogleAuthDto,
  RefreshTokenDto,
  ChangePasswordDto,
  FirebaseAuthDto,
} from './dto';
import * as admin from 'firebase-admin';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    credits: number;
    role: string;
  };
  tokens: AuthTokens;
}

// In-memory OTP store (use Redis in production)
const otpStore: Map<string, { otp: string; expiresAt: Date }> = new Map();

// In-memory login attempt tracker (use Redis in production)
const loginAttempts: Map<string, { count: number; lockedUntil: Date | null }> = new Map();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccount = this.configService.get<string>('firebase.serviceAccountJson');
      const projectId = this.configService.get<string>('firebase.projectId');

      if (serviceAccount) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
          });
          this.logger.log('Firebase Admin SDK initialized with service account');
        } catch (error) {
          this.logger.warn(`Firebase Admin SDK init with service account failed: ${error}`);
        }
      } else if (projectId) {
        try {
          admin.initializeApp({ projectId });
          this.logger.log('Firebase Admin SDK initialized with project ID only');
        } catch (error) {
          this.logger.warn(`Firebase Admin SDK init with project ID failed: ${error}`);
        }
      } else {
        this.logger.warn('Firebase Admin SDK not configured - set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID');
      }
    }
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: hashedPassword,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        timeOfBirth: dto.timeOfBirth,
        placeOfBirth: dto.placeOfBirth ? { name: dto.placeOfBirth } : undefined,
        credits: this.configService.get<number>('credits.freeMonthly', 10),
      },
    });

    this.logger.log(`User registered: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
      },
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    // Check rate limiting
    this.checkLoginAttempts(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      this.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.recordFailedAttempt(dto.email);
      const attempts = loginAttempts.get(dto.email);
      const remaining = MAX_LOGIN_ATTEMPTS - (attempts?.count || 0);
      if (remaining <= 2 && remaining > 0) {
        throw new UnauthorizedException(
          `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear attempts on successful login
    loginAttempts.delete(dto.email);

    this.logger.log(`User logged in: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
      },
      tokens,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Cannot change password for social login accounts. You signed in with Google/OTP.',
      );
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    this.logger.log(`Password changed for user: ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  async setPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    this.logger.log(`Password set for user: ${user.email}`);
    return { message: 'Password set successfully' };
  }

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
    // Rate limit OTP sends
    const existing = otpStore.get(dto.phone);
    if (existing && new Date() < new Date(existing.expiresAt.getTime() - 4 * 60 * 1000)) {
      throw new BadRequestException('Please wait before requesting a new OTP');
    }

    // Periodic cleanup of expired OTPs to prevent memory leaks
    this.cleanupExpiredOtps();

    const otpLength = this.configService.get<number>('otp.length', 6);
    const expiresInMinutes = this.configService.get<number>('otp.expiresInMinutes', 5);

    const otp = Array.from({ length: otpLength }, () =>
      Math.floor(Math.random() * 10),
    ).join('');

    otpStore.set(dto.phone, {
      otp,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    });

    // TODO: Integrate with SMS provider (Twilio, MSG91, etc.)
    this.logger.log(`OTP generated for ${dto.phone}`);

    return {
      message: 'OTP sent successfully',
      expiresIn: expiresInMinutes * 60,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const stored = otpStore.get(dto.phone);

    if (!stored) {
      throw new BadRequestException('No OTP found for this phone number. Please request a new one.');
    }

    if (new Date() > stored.expiresAt) {
      otpStore.delete(dto.phone);
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (stored.otp !== dto.otp) {
      throw new BadRequestException('Invalid OTP. Please check and try again.');
    }

    otpStore.delete(dto.phone);

    // Find or create user by phone
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: 'User',
          email: `${dto.phone.replace(/\+/g, '')}@phone.jyotron.com`,
          phone: dto.phone,
          credits: this.configService.get<number>('credits.freeMonthly', 10),
        },
      });
      this.logger.log(`New user created via OTP: ${dto.phone}`);
    }

    this.logger.log(`User logged in via OTP: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
      },
      tokens,
    };
  }

  async googleAuth(dto: GoogleAuthDto): Promise<AuthResponse> {
    // Verify Google ID token via Google's tokeninfo endpoint
    let googlePayload: { sub: string; email: string; name: string; picture?: string; email_verified?: string };

    try {
      const googleClientId = this.configService.get<string>('google.clientId');
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`;
      const response = await fetch(verifyUrl);

      if (!response.ok) {
        throw new Error('Invalid Google token');
      }

      const payload = await response.json();

      // Verify the token was issued for our client
      if (googleClientId && payload.aud !== googleClientId) {
        throw new Error('Token was not issued for this application');
      }

      if (payload.email_verified === 'false') {
        throw new Error('Google email not verified');
      }

      googlePayload = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture,
        email_verified: payload.email_verified,
      };
    } catch (error) {
      this.logger.error(`Google token verification failed: ${error}`);
      throw new UnauthorizedException('Invalid Google credentials. Please try again.');
    }

    // Find existing user by Google provider ID or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { provider: 'GOOGLE', providerId: googlePayload.sub },
          { email: googlePayload.email },
        ],
      },
    });

    if (user && user.provider !== 'GOOGLE') {
      // Existing email user - link their Google account
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { provider: 'GOOGLE', providerId: googlePayload.sub },
      });
      this.logger.log(`Linked Google account to existing user: ${user.email}`);
    } else if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          name: googlePayload.name,
          email: googlePayload.email,
          provider: 'GOOGLE',
          providerId: googlePayload.sub,
          credits: this.configService.get<number>('credits.freeMonthly', 10),
        },
      });
      this.logger.log(`New user created via Google: ${user.email}`);
    }

    this.logger.log(`User logged in via Google: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
      },
      tokens,
    };
  }

  async firebaseAuth(dto: FirebaseAuthDto): Promise<AuthResponse> {
    if (!admin.apps.length) {
      throw new UnauthorizedException('Firebase is not configured on the server');
    }

    let decodedToken: admin.auth.DecodedIdToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(dto.idToken);
    } catch (error) {
      this.logger.error(`Firebase token verification failed: ${error}`);
      throw new UnauthorizedException('Invalid Firebase token. Please try again.');
    }

    const uid = decodedToken.uid;
    const phone_number = decodedToken.phone_number;
    const email = decodedToken.email;
    const firebaseName = (decodedToken as any).name as string | undefined;
    const sign_in_provider = decodedToken.firebase?.sign_in_provider;

    // Determine provider type
    const isPhone = sign_in_provider === 'phone' || !!phone_number;
    const isGoogle = sign_in_provider === 'google.com';

    // Find existing user
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(phone_number ? [{ phone: phone_number }] : []),
          ...(email ? [{ email }] : []),
          { providerId: uid },
        ],
      },
    });

    if (user) {
      // Update provider info if needed
      const updates: any = {};
      if (isGoogle && user.provider !== 'GOOGLE') {
        updates.provider = 'GOOGLE';
        updates.providerId = uid;
      }
      if (phone_number && !user.phone) {
        updates.phone = phone_number;
      }
      if (Object.keys(updates).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updates,
        });
      }
    } else {
      // Create new user
      const userEmail = email || (phone_number ? `${phone_number.replace(/\+/g, '')}@phone.jyotron.com` : `firebase_${uid}@jyotron.com`);
      const userName = firebaseName || (phone_number ? 'User' : email?.split('@')[0] || 'User');

      user = await this.prisma.user.create({
        data: {
          name: userName,
          email: userEmail,
          phone: phone_number || null,
          provider: isGoogle ? 'GOOGLE' : 'PHONE',
          providerId: uid,
          credits: this.configService.get<number>('credits.freeMonthly', 10),
        },
      });
      this.logger.log(`New user created via Firebase (${sign_in_provider}): ${user.email}`);
    }

    this.logger.log(`User logged in via Firebase: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
        role: user.role,
      },
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      // Verify user still exists
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('User not found');

      return this.generateTokens(payload.sub, payload.email, payload.name);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getAuthStatus(userId: string): Promise<{ hasPassword: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return { hasPassword: !!user?.passwordHash };
  }

  private cleanupExpiredOtps(): void {
    const now = Date.now();
    for (const [phone, entry] of otpStore.entries()) {
      if (now > entry.expiresAt.getTime()) {
        otpStore.delete(phone);
      }
    }
    // Also clean up expired lockouts
    for (const [email, entry] of loginAttempts.entries()) {
      if (entry.lockedUntil && now > entry.lockedUntil.getTime()) {
        loginAttempts.delete(email);
      }
    }
  }

  private checkLoginAttempts(email: string): void {
    const attempts = loginAttempts.get(email);
    if (!attempts) return;

    if (attempts.lockedUntil && new Date() < attempts.lockedUntil) {
      const minutesLeft = Math.ceil(
        (attempts.lockedUntil.getTime() - Date.now()) / 60000,
      );
      throw new ForbiddenException(
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      );
    }

    // Reset if lockout has expired
    if (attempts.lockedUntil && new Date() >= attempts.lockedUntil) {
      loginAttempts.delete(email);
    }
  }

  private recordFailedAttempt(email: string): void {
    const attempts = loginAttempts.get(email) || { count: 0, lockedUntil: null };
    attempts.count += 1;

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
      attempts.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      this.logger.warn(`Account locked for ${email} after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
    }

    loginAttempts.set(email, attempts);
  }

  private async generateTokens(
    userId: string,
    email: string,
    name: string,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email, name };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn', '1d'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn', '1d'),
    };
  }
}
