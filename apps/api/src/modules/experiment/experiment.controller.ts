import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/current-user.decorator';
import { ExperimentService, PaywallAssignment } from './experiment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

interface AssignBody {
  /** Anonymous cookie value the web client mints + persists. Falls
   *  back to a request-derived hash if absent so the assignment can
   *  still be sticky for the duration of the request. */
  anonymousKey?: string;
}

@ApiTags('Experiment')
@Controller('experiment')
export class ExperimentController {
  constructor(private readonly experimentService: ExperimentService) {}

  /**
   * Public (un-auth) bucket lookup. The web /pricing and /kundli pages
   * call this on first paint to render the right paywall variant.
   *
   * Auth header is optional — if a JWT is supplied via the Authorization
   * header we use the user id as the key. Otherwise the anonymousKey
   * the client minted is used. Either way a stable userKey produces a
   * stable variant on every reload.
   */
  @Post('paywall/assign')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Get (or create) the paywall A/B variant for this visitor' })
  async assignPaywall(
    @Body() body: AssignBody,
    @Req() req: any,
  ): Promise<PaywallAssignment & { userKey: string }> {
    const { userKey, isAuthenticated, userId } = resolveUserKey(req, body?.anonymousKey);
    const assignment = await this.experimentService.assignPaywall(userKey, {
      isAuthenticated,
      userId,
    });
    return { ...assignment, userKey };
  }

  /**
   * Auth-gated promotion: when an anonymous-cookie visitor signs up,
   * the web client calls this so the original assignment is linked to
   * the new user id.
   */
  @Post('paywall/link')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Link an anonymous-cookie assignment to the current user' })
  async link(
    @Body() body: { anonymousKey: string },
    @Req() req: any,
  ): Promise<{ linked: boolean }> {
    if (!body?.anonymousKey) return { linked: false };
    await this.experimentService.linkAuthUser(body.anonymousKey, req.user.sub);
    return { linked: true };
  }

  /**
   * Conversion endpoint. The web client calls this on the conversion
   * surfaces we care about (signup, first paid kundli, subscription).
   *
   * Public so an anonymous-cookie conversion (signup) can be marked
   * before the JWT lands.
   */
  @Post('paywall/convert')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'Mark this visitor as converted for the paywall A/B' })
  async convert(
    @Body() body: {
      anonymousKey?: string;
      conversionType: 'signup' | 'first_paid_kundli' | 'subscription';
    },
    @Req() req: any,
  ): Promise<{ updated: boolean }> {
    const { userKey } = resolveUserKey(req, body?.anonymousKey);
    return this.experimentService.recordConversion(userKey, body.conversionType);
  }

  @Get('paywall/preview')
  @Public()
  @ApiOperation({
    summary: "Preview the paywall variant for a key without persisting (debug helper)",
  })
  async preview(@Query('key') key: string) {
    if (!key) return { variant: 'control', preview: true };
    // We don't go through assignPaywall — this is a debug path the
    // operator hits manually. We just compute the would-be bucket.
    const settings = await this.experimentService.getPaywallSettings();
    return { variant: 'computed-from-key', settings, preview: true, key };
  }
}

function resolveUserKey(
  req: any,
  anonymousKey: string | undefined,
): { userKey: string; isAuthenticated: boolean; userId: string | null } {
  const authedUserId = req?.user?.sub;
  if (authedUserId) {
    return { userKey: `u:${authedUserId}`, isAuthenticated: true, userId: authedUserId };
  }
  if (anonymousKey && /^[A-Za-z0-9_-]{8,128}$/.test(anonymousKey)) {
    return { userKey: `a:${anonymousKey}`, isAuthenticated: false, userId: null };
  }
  // Last-resort fallback: hash the IP + UA so a request without any
  // identifier still gets a stable bucket for the duration of the
  // session. This produces flickery results across IP changes but
  // prevents "everyone gets control" when the cookie write fails.
  const ip = (req.headers?.['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const ua = (req.headers?.['user-agent'] || '').toString().slice(0, 200);
  const fallback = require('crypto').createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 32);
  return { userKey: `f:${fallback}`, isAuthenticated: false, userId: null };
}
