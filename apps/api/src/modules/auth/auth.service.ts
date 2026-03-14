import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, SendOtpDto, VerifyOtpDto, GoogleAuthDto, RefreshTokenDto } from './dto';

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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

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

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; expiresIn: number }> {
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
    this.logger.log(`OTP sent to ${dto.phone}: ${otp} (dev mode)`);

    return {
      message: 'OTP sent successfully',
      expiresIn: expiresInMinutes * 60,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResponse> {
    const stored = otpStore.get(dto.phone);

    if (!stored) {
      throw new BadRequestException('No OTP found for this phone number');
    }

    if (new Date() > stored.expiresAt) {
      otpStore.delete(dto.phone);
      throw new BadRequestException('OTP has expired');
    }

    if (stored.otp !== dto.otp) {
      throw new BadRequestException('Invalid OTP');
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
          email: `${dto.phone.replace(/\+/g, '')}@phone.jyotryx.com`,
          phone: dto.phone,
          credits: this.configService.get<number>('credits.freeMonthly', 10),
        },
      });
    }

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
    // TODO: Verify Google ID token with Google OAuth2 API
    this.logger.warn('Google auth: using mock verification (implement Google OAuth2 verification)');

    // In production, decode the Google token and extract user info
    const email = 'google-user@example.com';
    const name = 'Google User';

    let user = await this.prisma.user.findFirst({
      where: { provider: 'GOOGLE', providerId: dto.idToken.substring(0, 50) },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name,
          email: `google_${Date.now()}@jyotryx.com`,
          provider: 'GOOGLE',
          providerId: dto.idToken.substring(0, 50),
          credits: this.configService.get<number>('credits.freeMonthly', 10),
        },
      });
    }

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

      return this.generateTokens(payload.sub, payload.email, payload.name);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
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
        expiresIn: this.configService.get<string>('jwt.expiresIn', '7d'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '30d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn', '7d'),
    };
  }
}
