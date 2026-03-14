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
import { v4 as uuidv4 } from 'uuid';
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
    phone?: string;
    credits: number;
  };
  tokens: AuthTokens;
}

// In-memory stores for development (replace with DB/Redis in production)
const usersStore: Map<string, {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  credits: number;
  createdAt: Date;
}> = new Map();

const otpStore: Map<string, { otp: string; expiresAt: Date }> = new Map();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = Array.from(usersStore.values()).find(
      (u) => u.email === dto.email,
    );
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const userId = uuidv4();

    const user = {
      id: userId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      password: hashedPassword,
      dateOfBirth: dto.dateOfBirth,
      timeOfBirth: dto.timeOfBirth,
      placeOfBirth: dto.placeOfBirth,
      credits: this.configService.get<number>('credits.freeMonthly', 10),
      createdAt: new Date(),
    };

    usersStore.set(userId, user);
    this.logger.log(`User registered: ${user.email}`);

    const tokens = await this.generateTokens(userId, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
      },
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = Array.from(usersStore.values()).find(
      (u) => u.email === dto.email,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
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
    let user = Array.from(usersStore.values()).find(
      (u) => u.phone === dto.phone,
    );

    if (!user) {
      const userId = uuidv4();
      user = {
        id: userId,
        name: 'User',
        email: `${dto.phone.replace(/\+/g, '')}@phone.jyotryx.com`,
        phone: dto.phone,
        password: '',
        credits: this.configService.get<number>('credits.freeMonthly', 10),
        createdAt: new Date(),
      };
      usersStore.set(userId, user);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        credits: user.credits,
      },
      tokens,
    };
  }

  async googleAuth(dto: GoogleAuthDto): Promise<AuthResponse> {
    // TODO: Verify Google ID token with Google OAuth2 API
    // For now, return mock data
    this.logger.warn('Google auth: using mock verification (implement Google OAuth2 verification)');

    const mockUserId = uuidv4();
    const tokens = await this.generateTokens(
      mockUserId,
      'google-user@example.com',
      'Google User',
    );

    return {
      user: {
        id: mockUserId,
        name: 'Google User',
        email: 'google-user@example.com',
        credits: this.configService.get<number>('credits.freeMonthly', 10),
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
