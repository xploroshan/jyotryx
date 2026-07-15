import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResponse, AuthTokens, RegisterResult } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  SendOtpDto,
  VerifyOtpDto,
  GoogleAuthDto,
  RefreshTokenDto,
  ChangePasswordDto,
  SetPasswordDto,
  FirebaseAuthDto,
  ForgotPasswordDto,
  VerifyEmailDto,
} from './dto';
import { Public } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { buildSignupContext } from './signup-context';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() dto: RegisterDto, @Request() req: any): Promise<RegisterResult> {
    const ctx = buildSignupContext({
      acceptLanguage: req?.headers?.['accept-language'],
      bodyLocale: dto.locale,
      bodyCountry: dto.country,
      bodySignupSource: dto.signupSource,
    });
    return this.authService.register(dto, ctx);
  }

  @Post('verify-email')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address from the emailed token' })
  @ApiResponse({ status: 200, description: 'Email verified; returns auth tokens' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthResponse> {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-send the email-verification link' })
  @ApiResponse({ status: 200, description: 'Verification email sent if applicable' })
  async resendVerification(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.resendVerification(dto.email);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked' })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('otp/send')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async sendOtp(
    @Body() dto: SendOtpDto,
  ): Promise<{ message: string; expiresIn: number; devOtp?: string }> {
    return this.authService.sendOtp(dto);
  }

  @Post('otp/verify')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and authenticate' })
  @ApiResponse({ status: 200, description: 'OTP verified, user authenticated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Request() req: any): Promise<AuthResponse> {
    const ctx = buildSignupContext({
      acceptLanguage: req?.headers?.['accept-language'],
      bodyLocale: (dto as any).locale,
      bodyCountry: (dto as any).country,
      bodySignupSource: (dto as any).signupSource,
    });
    return this.authService.verifyOtp(dto, ctx);
  }

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Google ID token' })
  @ApiResponse({ status: 200, description: 'Google auth successful' })
  async googleAuth(@Body() dto: GoogleAuthDto, @Request() req: any): Promise<AuthResponse> {
    const ctx = buildSignupContext({
      acceptLanguage: req?.headers?.['accept-language'],
      bodyLocale: (dto as any).locale,
      bodyCountry: (dto as any).country,
      bodySignupSource: (dto as any).signupSource,
    });
    return this.authService.googleAuth(dto, ctx);
  }

  @Post('firebase')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with Firebase ID token (Phone OTP or Google)' })
  @ApiResponse({ status: 200, description: 'Firebase auth successful' })
  @ApiResponse({ status: 401, description: 'Invalid Firebase token' })
  async firebaseAuth(@Body() dto: FirebaseAuthDto, @Request() req: any): Promise<AuthResponse> {
    const ctx = buildSignupContext({
      acceptLanguage: req?.headers?.['accept-language'],
      bodyLocale: (dto as any).locale,
      bodyCountry: (dto as any).country,
      bodySignupSource: (dto as any).signupSource,
    });
    return this.authService.firebaseAuth(dto, ctx);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token (with rotation)' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token or reuse detected' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token family' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password incorrect or validation failed' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Request() req: any,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(req.user.sub, dto);
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Set password for OTP/social login users' })
  @ApiResponse({ status: 200, description: 'Password set successfully' })
  async setPassword(
    @Body() dto: SetPasswordDto,
    @Request() req: any,
  ): Promise<{ message: string }> {
    return this.authService.setPassword(req.user.sub, dto.password);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get auth status (has password, etc.)' })
  async getStatus(@Request() req: any): Promise<{ hasPassword: boolean }> {
    return this.authService.getAuthStatus(req.user.sub);
  }
}
