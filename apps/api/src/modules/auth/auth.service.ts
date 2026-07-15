import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  ForbiddenException,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
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
import { isProfileComplete } from '../user/user.service';
import { SignupContext } from './signup-context';
import { ReferralService } from '../referral/referral.service';
import { normalizePhone, phoneMatchCandidates } from '../../common/phone.util';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

type PrismaUser = {
  id: string;
  name: string;
  nickname?: string | null;
  email: string;
  phone: string | null;
  credits: number;
  role: string;
  dateOfBirth: Date | null;
  timeOfBirth: string | null;
  placeOfBirth: any;
  gender: string | null;
  preferredLanguage?: string;
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    nickname?: string | null;
    email: string;
    phone?: string | null;
    credits: number;
    role: string;
    preferredLanguage: string;
    profileComplete: boolean;
    dateOfBirth?: string | null;
    timeOfBirth?: string | null;
    placeOfBirth?: string | null;
    gender?: string | null;
    astrologyTraditions?: string[];
    primaryTradition?: string | null;
  };
  tokens: AuthTokens;
}

function extractPlaceName(place: any): string | null {
  if (!place) return null;
  if (typeof place === 'string') return place;
  if (typeof place === 'object' && typeof place.name === 'string') return place.name;
  return null;
}

function toAuthUser(user: PrismaUser & { preferredLanguage?: string }): AuthResponse['user'] {
  return {
    id: user.id,
    name: user.name,
    nickname: (user as any).nickname ?? null,
    email: user.email,
    phone: user.phone,
    credits: user.credits,
    role: user.role,
    preferredLanguage: (user as any).preferredLanguage ?? 'en',
    profileComplete: isProfileComplete(user),
    dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : null,
    timeOfBirth: user.timeOfBirth ?? null,
    placeOfBirth: extractPlaceName(user.placeOfBirth),
    gender: user.gender ?? null,
    astrologyTraditions: (user as any).astrologyTraditions ?? undefined,
    primaryTradition: (user as any).primaryTradition ?? null,
  };
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Resolve the signup-credits default. `ConfigService.get` has returned
   * `undefined`/`NaN` in some production deploys (seen on Railway), which
   * then propagates into Prisma's `user.create()` and fails with
   * "Argument `credits` is missing" because the generated client treats
   * `undefined` for a non-optional field as missing. Coerce defensively so
   * every call site always gets a concrete integer.
   */
  private get signupCredits(): number {
    const raw = this.configService.get<number | string>('credits.freeMonthly');
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) && n >= 0 ? n : 10;
  }

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    // Optional so the ~14 unit-test suites that hand-build AuthService
    // with `Test.createTestingModule({ providers: [...] })` don't have
    // to all be updated. In production the AuthModule imports
    // ReferralModule so this is always wired.
    @Optional() private readonly referralService?: ReferralService,
  ) {
    // Initialize Firebase Admin SDK
    if (!getApps().length) {
      const serviceAccount = this.configService.get<string>('firebase.serviceAccountJson');
      const projectId = this.configService.get<string>('firebase.projectId');

      if (serviceAccount) {
        try {
          // Strip surrounding quotes if Render double-wraps the value
          let cleanJson = serviceAccount.trim();
          if (cleanJson.startsWith("'") && cleanJson.endsWith("'")) {
            cleanJson = cleanJson.slice(1, -1);
          }
          if (cleanJson.startsWith('"') && cleanJson.endsWith('"') && cleanJson[1] === '{') {
            cleanJson = cleanJson.slice(1, -1);
          }
          const parsed = JSON.parse(cleanJson);
          initializeApp({
            credential: cert(parsed),
          });
          this.logger.log('Firebase Admin SDK initialized with service account');
        } catch (error) {
          this.logger.warn(`Firebase Admin SDK init with service account failed: ${error}`);
          this.logger.warn('Hint: FIREBASE_SERVICE_ACCOUNT_JSON must be valid single-line JSON. Check for extra quotes or escape characters.');
          // Fall back to project ID if available
          if (projectId) {
            try {
              initializeApp({ projectId });
              this.logger.log('Firebase Admin SDK fallback: initialized with project ID only');
            } catch (fallbackError) {
              this.logger.warn(`Firebase Admin SDK fallback also failed: ${fallbackError}`);
            }
          }
        }
      } else if (projectId) {
        try {
          initializeApp({ projectId });
          this.logger.log('Firebase Admin SDK initialized with project ID only');
        } catch (error) {
          this.logger.warn(`Firebase Admin SDK init with project ID failed: ${error}`);
        }
      } else {
        this.logger.warn('Firebase Admin SDK not configured - set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID');
      }
    }
  }

  async register(dto: RegisterDto, signupContext?: SignupContext): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Also create user in Firebase Auth so password reset emails work
    if (getApps().length) {
      try {
        await getAuth().createUser({
          email: dto.email,
          password: dto.password,
          displayName: dto.name,
        });
        this.logger.log(`Firebase Auth user created for: ${dto.email}`);
      } catch (firebaseError: any) {
        // If user already exists in Firebase, that's fine
        if (firebaseError.code !== 'auth/email-already-exists') {
          this.logger.warn(`Failed to create Firebase Auth user: ${firebaseError.message}`);
        }
      }
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash: hashedPassword,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        timeOfBirth: dto.timeOfBirth,
        placeOfBirth: dto.placeOfBirth ? { name: dto.placeOfBirth } : undefined,
        credits: this.signupCredits,
        // Phase 2 growth-analytics dimensions. Null-safe: the client can
        // omit the header / body fields and the user simply lands
        // un-tagged, which shows up as an "unknown" bucket in funnel
        // views rather than breaking the insert.
        locale:       signupContext?.locale ?? undefined,
        country:      signupContext?.country ?? undefined,
        signupSource: signupContext?.signupSource ?? undefined,
      },
    });

    this.logger.log(`User registered: ${user.email}`);
    // Phase 1 monetization — fan out to the referral service. Soft
    // failure here is intentional: signup must succeed even if the
    // referral grant doesn't (program disabled, cap reached, etc.).
    if (this.referralService) await this.referralService.activateAtSignup(user.id, dto.ref);
    // Re-fetch the user so the response carries any role/credit
    // changes the activation made (Premium upgrade, etc.) instead of
    // showing the stale row created two statements ago.
    const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: toAuthUser(refreshed ?? user),
      tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    // Check rate limiting
    await this.checkLoginAttempts(dto.email);

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      await this.recordFailedAttempt(dto.email);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(dto.email);
      const failCount = parseInt(await this.redis.get(`login:fail:${dto.email}`) || '0');
      const remaining = MAX_LOGIN_ATTEMPTS - failCount;
      if (remaining <= 2 && remaining > 0) {
        throw new UnauthorizedException(
          `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
        );
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear attempts on successful login
    await this.clearLoginAttempts(dto.email);

    this.logger.log(`User logged in: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: toAuthUser(user),
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

    // A password change is a credential-rotation event: revoke every existing
    // refresh-token family so sessions established with the old password can't
    // outlive it (they otherwise survive for the full 30-day refresh lifetime).
    // The current access token remains valid until it expires (~1h) — the
    // standard short-lived-JWT trade-off — but no session can be refreshed.
    await this.revokeAllUserTokens(userId).catch((err) =>
      this.logger.error(`Failed to revoke tokens after password change for ${user.email}: ${err?.message || err}`),
    );

    this.logger.log(`Password changed for user: ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  async setPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.passwordHash) {
      throw new BadRequestException(
        'Password already set. Use the change password feature instead.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    this.logger.log(`Password set for user: ${user.email}`);
    return { message: 'Password set successfully' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    // Check if user exists in our database
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.log(`Forgot password requested for non-existent email: ${email}`);
      return { message: 'If an account exists with this email, a password reset link has been sent.' };
    }

    if (!getApps().length) {
      this.logger.warn('Firebase Admin SDK not configured - cannot send password reset email');
      throw new BadRequestException('Password reset is not available at this time. Please contact support.');
    }

    // Ensure the user exists in Firebase Auth
    try {
      await getAuth().getUserByEmail(email);
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/user-not-found') {
        // Create the user in Firebase Auth so password reset works
        try {
          await getAuth().createUser({
            email: user.email,
            displayName: user.name,
            // Generate a random password - user will reset it via the email link
            password: crypto.randomBytes(16).toString('hex'),
          });
          this.logger.log(`Created Firebase Auth user for password reset: ${email}`);
        } catch (createError: any) {
          this.logger.error(`Failed to create Firebase Auth user: ${createError.message}`);
          throw new BadRequestException('Password reset is not available at this time. Please contact support.');
        }
      } else {
        this.logger.error(`Firebase getUserByEmail error: ${firebaseError.message}`);
        throw new BadRequestException('Password reset is not available at this time. Please contact support.');
      }
    }

    // NOTE: we deliberately do NOT call generatePasswordResetLink() here.
    // That mints a NEW reset code, and Firebase invalidates every prior code
    // for the email whenever a new one is issued — so it would kill the code
    // the client's sendPasswordResetEmail() just emailed to the user (the
    // "reset link expired / already used" bug on the very first click). It
    // also sends no email of its own (the Admin SDK just returns a link
    // string). This endpoint's only job is to guarantee the Firebase Auth
    // user EXISTS (done above) so the client-side send can succeed for
    // accounts created before Firebase was wired up; the client owns the
    // single reset code + email.
    return { message: 'If an account exists with this email, a password reset link has been sent.' };
  }

  async sendOtp(
    dto: SendOtpDto,
  ): Promise<{ message: string; expiresIn: number; devOtp?: string }> {
    const phone = this.normalizePhone(dto.phone);

    // Rate limit OTP sends: block if OTP was set less than 1 minute ago
    const ttl = await this.redis.ttl(`otp:${phone}`);
    const expiresInMinutes = this.configService.get<number>('otp.expiresInMinutes', 5);
    if (ttl > (expiresInMinutes - 1) * 60) {
      throw new BadRequestException('Please wait before requesting a new OTP');
    }

    const otpLength = this.configService.get<number>('otp.length', 6);

    const otp = Array.from({ length: otpLength }, () =>
      crypto.randomInt(0, 10),
    ).join('');

    await this.redis.set(`otp:${phone}`, otp, 'EX', expiresInMinutes * 60);

    // Best-effort SMS delivery — never blocks a successful response. If the
    // provider is disabled or fails, we still return success so the dev/staging
    // `devOtp` flow keeps working.
    this.sendSmsOtp(phone, otp, expiresInMinutes).catch((err) =>
      this.logger.warn(`SMS OTP delivery failed for ${phone}: ${err?.message || err}`),
    );

    this.logger.log(`OTP generated for ${phone}`);

    const exposeOtp = this.configService.get<boolean>('otp.exposeOtpInResponse', false);
    return {
      message: 'OTP sent successfully',
      expiresIn: expiresInMinutes * 60,
      ...(exposeOtp ? { devOtp: otp } : {}),
    };
  }

  /**
   * Constant-time string comparison so response timing can't reveal how many
   * leading characters of a secret (e.g. an OTP) matched.
   */
  private constantTimeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  async verifyOtp(dto: VerifyOtpDto, signupContext?: SignupContext): Promise<AuthResponse> {
    const phone = this.normalizePhone(dto.phone);
    const otpKey = `otp:${phone}`;
    const failKey = `otp:fail:${phone}`;
    const maxAttempts = this.configService.get<number>('otp.maxVerifyAttempts', 5);
    const ttlSeconds = this.configService.get<number>('otp.expiresInMinutes', 5) * 60;

    // Per-phone brute-force cap: a 6-digit OTP must not be guessable by
    // hammering verify (the IP throttle alone is bypassable via rotating IPs).
    const priorFails = Number((await this.redis.get(failKey)) ?? 0);
    if (priorFails >= maxAttempts) {
      await this.redis.del(otpKey);
      throw new BadRequestException('Too many incorrect attempts. Please request a new OTP.');
    }

    const stored = await this.redis.get(otpKey);

    if (!stored) {
      throw new BadRequestException('No OTP found for this phone number. Please request a new one.');
    }

    if (!this.constantTimeEquals(stored, dto.otp)) {
      const attempts = await this.redis.incr(failKey);
      await this.redis.expire(failKey, ttlSeconds);
      if (attempts >= maxAttempts) {
        // Burn the OTP so a locked-out secret can never be completed.
        await this.redis.del(otpKey);
      }
      throw new BadRequestException('Invalid OTP. Please check and try again.');
    }

    await this.redis.del(otpKey);
    await this.redis.del(failKey);

    // Find or create user by phone. Match every equivalent format (and prefer
    // the oldest row) so a returning user whose number was stored unnormalized
    // is recognised rather than duplicated — same matching as firebaseAuth.
    let user = await this.prisma.user.findFirst({
      where: { phone: { in: phoneMatchCandidates(phone) } },
      orderBy: { createdAt: 'asc' },
    });

    if (!user) {
      const signupName = dto.name?.trim();
      user = await this.prisma.user.create({
        data: {
          name: signupName && signupName.length > 0 ? signupName : 'User',
          email: `${phone.replace(/\+/g, '')}@phone.myastro360.com`,
          phone,
          credits: this.signupCredits,
          locale:       signupContext?.locale ?? undefined,
          country:      signupContext?.country ?? undefined,
          signupSource: signupContext?.signupSource ?? undefined,
        },
      });
      this.logger.log(`New user created via OTP: ${phone}`);
      if (this.referralService) await this.referralService.activateAtSignup(user.id, dto.ref);
      const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (refreshed) user = refreshed;
    }

    this.logger.log(`User logged in via OTP: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: toAuthUser(user),
      tokens,
    };
  }

  /**
   * Normalize a phone number so that the same user who enters "9876543210",
   * "+91 9876543210", and "+919876543210" hits the same OTP slot. We strip
   * whitespace/dashes/parens and ensure a leading '+' (prepending the default
   * +91 country code for bare 10-digit numbers).
   */
  private normalizePhone(raw: string): string {
    // Delegates to the shared util so auth and profile use one canonical form.
    return normalizePhone(raw);
  }

  /**
   * Best-effort SMS OTP delivery. Supports Twilio out of the box via REST
   * (no extra npm dep). If SMS_PROVIDER is unset or the Twilio credentials
   * are missing we log the OTP and return — the devOtp response field still
   * lets dev/staging clients authenticate.
   */
  private async sendSmsOtp(
    phone: string,
    otp: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const provider = (this.configService.get<string>('sms.provider') || '').toLowerCase();

    if (provider !== 'twilio') {
      // No provider configured — the logger entry above is the only delivery.
      return;
    }

    const accountSid = this.configService.get<string>('sms.twilio.accountSid');
    const authToken = this.configService.get<string>('sms.twilio.authToken');
    const fromPhone = this.configService.get<string>('sms.twilio.fromPhone');

    if (!accountSid || !authToken || !fromPhone) {
      this.logger.warn(
        'SMS_PROVIDER=twilio but TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_PHONE are not all set — skipping send.',
      );
      return;
    }

    const body = `Your myastro360 verification code is ${otp}. It expires in ${expiresInMinutes} minute${expiresInMinutes === 1 ? '' : 's'}. Do not share this code.`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const authHeader = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
    const form = new URLSearchParams();
    form.append('To', phone);
    form.append('From', fromPhone);
    form.append('Body', body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Twilio ${response.status}: ${errText.slice(0, 200)}`);
    }
    this.logger.log(`SMS OTP delivered via Twilio to ${phone}`);
  }

  async googleAuth(dto: GoogleAuthDto, signupContext?: SignupContext): Promise<AuthResponse> {
    // Verify Google ID token via Google's tokeninfo endpoint (which validates
    // the signature and expiry server-side and 4xxs on invalid/expired
    // tokens).
    let googlePayload: { sub: string; email: string; name: string; picture?: string; email_verified?: string };

    // Fail CLOSED when the client id isn't configured. Previously the
    // audience check was skipped entirely when GOOGLE_CLIENT_ID was unset
    // (the default ''), which meant a valid Google ID token minted for ANY
    // other OAuth client was accepted → account takeover by email.
    const googleClientId = this.configService.get<string>('google.clientId');
    if (!googleClientId) {
      this.logger.error('Google sign-in attempted but GOOGLE_CLIENT_ID is not configured');
      throw new UnauthorizedException('Google sign-in is not available right now.');
    }

    try {
      const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`;
      const response = await fetch(verifyUrl);

      if (!response.ok) {
        throw new Error('Invalid Google token');
      }

      const payload = await response.json();

      // ALWAYS verify the token was issued for our client (aud === clientId).
      if (payload.aud !== googleClientId) {
        throw new Error('Token was not issued for this application');
      }

      // Require a verified email — accept only an explicit truthy value, not
      // merely "not the string false" (a token missing the field would
      // otherwise slip through).
      if (payload.email_verified !== true && payload.email_verified !== 'true') {
        throw new Error('Google email not verified');
      }

      if (!payload.sub || !payload.email) {
        throw new Error('Google token missing subject or email');
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
          credits: this.signupCredits,
          locale:       signupContext?.locale ?? undefined,
          country:      signupContext?.country ?? undefined,
          signupSource: signupContext?.signupSource ?? undefined,
        },
      });
      this.logger.log(`New user created via Google: ${user.email}`);
      if (this.referralService) await this.referralService.activateAtSignup(user.id, dto.ref);
      const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (refreshed) user = refreshed;
    }

    this.logger.log(`User logged in via Google: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: toAuthUser(user),
      tokens,
    };
  }

  async firebaseAuth(dto: FirebaseAuthDto, signupContext?: SignupContext): Promise<AuthResponse> {
    if (!getApps().length) {
      throw new UnauthorizedException('Firebase is not configured on the server');
    }

    let decodedToken: DecodedIdToken;
    try {
      decodedToken = await getAuth().verifyIdToken(dto.idToken);
    } catch (error) {
      this.logger.error(`Firebase token verification failed: ${error}`);
      throw new UnauthorizedException('Invalid Firebase token. Please try again.');
    }

    const uid = decodedToken.uid;
    const phone_number = decodedToken.phone_number;
    const email = decodedToken.email;
    const emailVerified = decodedToken.email_verified === true;
    const firebaseName = (decodedToken as any).name as string | undefined;
    const sign_in_provider = decodedToken.firebase?.sign_in_provider;

    // Determine provider type
    const isPhone = sign_in_provider === 'phone' || !!phone_number;
    const isGoogle = sign_in_provider === 'google.com';

    // SECURITY: only trust the email as an account-matching key when Firebase
    // reports it verified (federated sign-in such as google.com always is).
    // An unverified email/password token must NOT be able to match — and thereby
    // log into — an existing account, otherwise anyone can register in Firebase
    // with a victim's email address (without ever proving ownership) and take
    // over that victim's account here. Returning users still match on their
    // stable Firebase uid via providerId below, so this does not break login.
    const trustedEmail = email && (emailVerified || isGoogle) ? email : undefined;

    // Find existing user. Phone is matched against every equivalent format
    // (E.164, no-plus, 10-digit, trunk-zero) so a returning user whose number
    // was stored before normalization — e.g. "9880141543" in their profile vs
    // Firebase's "+919880141543" — is recognised instead of duplicated.
    // Oldest-first so we land on the original account, never an accidental
    // duplicate that a prior version of this bug may have created.
    const phoneCandidates = phone_number ? phoneMatchCandidates(phone_number) : [];
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(phoneCandidates.length ? [{ phone: { in: phoneCandidates } }] : []),
          ...(trustedEmail ? [{ email: trustedEmail }] : []),
          { providerId: uid },
        ],
      },
      orderBy: { createdAt: 'asc' },
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
      const userEmail = email || (phone_number ? `${phone_number.replace(/\+/g, '')}@phone.myastro360.com` : `firebase_${uid}@myastro360.com`);
      const userName = firebaseName || (phone_number ? 'User' : email?.split('@')[0] || 'User');

      user = await this.prisma.user.create({
        data: {
          name: userName,
          email: userEmail,
          phone: phone_number || null,
          provider: isGoogle ? 'GOOGLE' : 'PHONE',
          providerId: uid,
          credits: this.signupCredits,
          locale:       signupContext?.locale ?? undefined,
          country:      signupContext?.country ?? undefined,
          signupSource: signupContext?.signupSource ?? undefined,
        },
      });
      this.logger.log(`New user created via Firebase (${sign_in_provider}): ${user.email}`);
      if (this.referralService) await this.referralService.activateAtSignup(user.id, dto.ref);
      const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (refreshed) user = refreshed;
    }

    this.logger.log(`User logged in via Firebase: ${user.email}`);
    const tokens = await this.generateTokens(user.id, user.email, user.name);

    return {
      user: toAuthUser(user),
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthTokens> {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const { jti, familyId, sub, email, name } = payload;

    // Pre-rotation (jti-less) refresh tokens bypass reuse-detection and
    // force-logout entirely, so a stolen one was replayable for its full
    // 30-day life and immune to revocation. Rotation has shipped and every
    // new token carries a jti, so any jti-less token is stale by definition —
    // reject it and make the holder re-authenticate once to get a rotated,
    // revocable token.
    if (!jti || !familyId) {
      throw new UnauthorizedException('Please sign in again to continue.');
    }

    // Check token in Redis
    const tokenData = await this.redis.get(`rt:${jti}`);
    if (!tokenData) {
      // Token not found — either expired or already revoked
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const parsed = JSON.parse(tokenData);

    if (parsed.used) {
      // Reuse detected — possible token theft. Revoke the entire family.
      this.logger.warn(`Refresh token reuse detected for family ${familyId}, user ${sub}. Revoking family.`);
      await this.revokeFamilyTokens(familyId);
      throw new UnauthorizedException('Refresh token reuse detected. All sessions revoked for security.');
    }

    // Mark current token as used
    const ttl = await this.redis.ttl(`rt:${jti}`);
    if (ttl > 0) {
      await this.redis.set(`rt:${jti}`, JSON.stringify({ ...parsed, used: true }), 'EX', ttl);
    }

    // Verify user still exists
    const user = await this.prisma.user.findUnique({ where: { id: sub } });
    if (!user) {
      await this.revokeFamilyTokens(familyId);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.generateTokens(sub, email, name, familyId);
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      if (payload.familyId) {
        await this.revokeFamilyTokens(payload.familyId);
        this.logger.log(`User ${payload.sub} logged out, family ${payload.familyId} revoked`);
      }
    } catch {
      // Token is invalid/expired — nothing to revoke, still return success
    }

    return { message: 'Logged out' };
  }

  private async revokeFamilyTokens(familyId: string): Promise<void> {
    const familyKey = `rt:family:${familyId}`;
    const members = await this.redis.smembers(familyKey);
    if (members.length > 0) {
      const pipeline = this.redis.pipeline();
      for (const jti of members) {
        pipeline.del(`rt:${jti}`);
      }
      pipeline.del(familyKey);
      await pipeline.exec();
    } else {
      await this.redis.del(familyKey);
    }
  }

  /**
   * Invalidate every refresh-token family for a user — the backing
   * primitive for the Phase 3 admin "force logout" action. Walks the
   * `rt:user-families:{userId}` reverse index written by
   * `generateTokens()`, calls `revokeFamilyTokens()` for each family,
   * then clears the reverse index itself. Returns the number of
   * families that were revoked so the admin UI can confirm "N sessions
   * terminated".
   *
   * Access tokens in flight keep working until they expire (default
   * 1h) — that's the fundamental JWT trade-off. We can't revoke them
   * without moving to a stateful access-token layer.
   */
  async revokeAllUserTokens(userId: string): Promise<{ familiesRevoked: number }> {
    const indexKey = `rt:user-families:${userId}`;
    const familyIds = await this.redis.smembers(indexKey);
    if (familyIds.length === 0) {
      // No known families — clear the index in case it's a stale empty
      // set (Redis sets aren't auto-removed when empty on some ops).
      await this.redis.del(indexKey);
      return { familiesRevoked: 0 };
    }
    for (const familyId of familyIds) {
      await this.revokeFamilyTokens(familyId);
    }
    await this.redis.del(indexKey);
    this.logger.log(`Force-logout: revoked ${familyIds.length} refresh-token families for user ${userId}`);
    return { familiesRevoked: familyIds.length };
  }

  async getAuthStatus(userId: string): Promise<{ hasPassword: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return { hasPassword: !!user?.passwordHash };
  }

  private async checkLoginAttempts(email: string): Promise<void> {
    // Redis-backed lockout — best-effort. When Redis is unreachable
    // (e.g. Upstash rate-limited) treat the account as "not locked"
    // rather than 500-ing the login. Trading slightly weaker
    // brute-force protection for the API actually responding to
    // logins; password validation against the DB still applies.
    let locked: string | null = null;
    try {
      locked = await this.redis.get(`login:lock:${email}`);
    } catch (err) {
      this.logger.warn(
        `Login-lock check skipped (Redis unavailable): ${(err as Error)?.message ?? err}`,
      );
      return;
    }
    if (locked) {
      let ttl = 0;
      try { ttl = await this.redis.ttl(`login:lock:${email}`); } catch { /* best-effort */ }
      const minutesLeft = Math.ceil(ttl / 60);
      throw new ForbiddenException(
        `Account temporarily locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      );
    }
  }

  private async recordFailedAttempt(email: string): Promise<void> {
    const key = `login:fail:${email}`;
    try {
      const count = await this.redis.incr(key);
      await this.redis.expire(key, LOCKOUT_SECONDS);

      if (count >= MAX_LOGIN_ATTEMPTS) {
        await this.redis.set(`login:lock:${email}`, '1', 'EX', LOCKOUT_SECONDS);
        await this.redis.del(key);
        this.logger.warn(`Account locked for ${email} after ${MAX_LOGIN_ATTEMPTS} failed attempts`);
      }
    } catch (err) {
      // Don't propagate — the caller is already returning a 401
      // UnauthorizedException; we just lose the fail-count bump.
      this.logger.warn(
        `Failed-attempt tracking skipped (Redis unavailable): ${(err as Error)?.message ?? err}`,
      );
    }
  }

  private async clearLoginAttempts(email: string): Promise<void> {
    try {
      await this.redis.del(`login:fail:${email}`, `login:lock:${email}`);
    } catch (err) {
      this.logger.warn(
        `Clearing login attempts skipped (Redis unavailable): ${(err as Error)?.message ?? err}`,
      );
    }
  }

  /**
   * Mint a short-lived access-only JWT for admin user impersonation.
   *
   * Intentionally different from generateTokens():
   *  - 1-hour TTL (not configurable) so an impersonation session can't
   *    silently outlive the admin's intent.
   *  - NO refresh token — impersonation ends at expiry, no renewal.
   *  - Carries `impersonatedBy` so the web client can render a warning
   *    banner and server-side handlers (future) can flag the traffic.
   *
   * Caller (AdminService.impersonateUser) is responsible for writing
   * the activity_log row that records who impersonated whom.
   */
  async issueImpersonationToken(
    targetUserId: string,
    targetEmail: string,
    targetName: string,
    adminEmail: string,
  ): Promise<{ accessToken: string; expiresAt: string }> {
    const ttlSeconds = 60 * 60; // 1 hour, fixed
    const payload = {
      sub: targetUserId,
      email: targetEmail,
      name: targetName,
      impersonatedBy: adminEmail,
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: ttlSeconds,
    });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    this.logger.log(
      `Impersonation token issued: admin=${adminEmail} target=${targetEmail} expires=${expiresAt}`,
    );
    return { accessToken, expiresAt };
  }

  private async generateTokens(
    userId: string,
    email: string,
    name: string,
    existingFamilyId?: string,
  ): Promise<AuthTokens> {
    const jti = crypto.randomUUID();
    const familyId = existingFamilyId || crypto.randomUUID();
    const accessPayload = { sub: userId, email, name };
    const refreshPayload = { sub: userId, email, name, jti, familyId };

    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn', '30d');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn', '1d') as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    // Store refresh token metadata in Redis.
    //
    // `rt:user-families:{userId}` is a reverse index that lets
    // `revokeAllUserTokens()` (Phase 3 force-logout) walk every
    // family that belongs to a user without having to SCAN every
    // `rt:*` key. Writing it here means both fresh logins and
    // refresh-rotation land in the set; the TTL is bumped every time
    // so the set's lifetime tracks the longest-living family.
    //
    // Best-effort: when Redis is unreachable, log a warning and still
    // hand out tokens. The user gets a working access token for its
    // TTL; refresh-rotation simply won't find the family record and
    // will reject, so the user has to re-login once the access token
    // expires. Preferable to failing login entirely.
    const ttlSeconds = this.parseExpiryToSeconds(refreshExpiresIn);
    try {
      const pipeline = this.redis.pipeline();
      pipeline.set(`rt:${jti}`, JSON.stringify({ userId, familyId, used: false }), 'EX', ttlSeconds);
      pipeline.sadd(`rt:family:${familyId}`, jti);
      pipeline.expire(`rt:family:${familyId}`, ttlSeconds);
      pipeline.sadd(`rt:user-families:${userId}`, familyId);
      pipeline.expire(`rt:user-families:${userId}`, ttlSeconds);
      await pipeline.exec();
    } catch (err) {
      this.logger.warn(
        `Refresh-token persistence skipped (Redis unavailable): ${(err as Error)?.message ?? err}. ` +
          `Tokens issued without rotation tracking — refresh will fail and user must re-login at access-token expiry.`,
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.expiresIn', '1d'),
    };
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 30 * 24 * 3600; // default 30 days
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 30 * 86400;
    }
  }
}
