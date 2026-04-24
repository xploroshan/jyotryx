import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService, DashboardStats, UserListItem, UserDetail, AdminUserUpdate, PlatformAnalytics, LlmCostRow } from './admin.service';
import {
  GrowthAnalyticsService,
  FunnelCounts,
  CohortRow,
  MrrSnapshot,
  LtvArpuSnapshot,
  ChurnRiskRow,
  PaymentFailureRow,
} from '../../stats/growth-analytics.service';
import {
  OpsHealthService,
  LlmErrorRateRow,
  LatencyBucket,
  CacheHitRow,
  QueueDepthRow,
  ServiceHealth,
} from '../../ops/ops-health.service';
import { BroadcastService, BroadcastRequest } from '../../ops/broadcast.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';

const KNOWN_LLM_PROVIDERS = new Set(['openai', 'gemini', 'anthropic', 'mistral', 'cohere', 'groq', 'google']);

@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly growth: GrowthAnalyticsService,
    private readonly ops: OpsHealthService,
    private readonly broadcastService: BroadcastService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats returned' })
  async getDashboard(): Promise<DashboardStats> {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users with pagination' })
  @ApiResponse({ status: 200, description: 'User list returned' })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ): Promise<{ users: UserListItem[]; total: number }> {
    return this.adminService.getUsers(
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      search,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get detailed user information' })
  @ApiResponse({ status: 200, description: 'User detail returned' })
  async getUserDetail(@Param('id', ParseUUIDPipe) userId: string): Promise<UserDetail> {
    return this.adminService.getUserDetail(userId);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user details' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: AdminUserUpdate,
    @Request() req: any,
  ): Promise<UserListItem> {
    return this.adminService.updateUser(userId, dto, req.user.sub, req.user.email);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ): Promise<{ deleted: boolean }> {
    return this.adminService.deleteUser(userId, req.user.sub, req.user.email);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get recent payments' })
  @ApiResponse({ status: 200, description: 'Payment list returned' })
  async getPayments(@Query('limit') limit?: string) {
    return this.adminService.getRecentPayments(parseInt(limit || '20', 10));
  }

  @Get('chats')
  @ApiOperation({ summary: 'Get recent chat sessions' })
  @ApiResponse({ status: 200, description: 'Chat session list returned' })
  async getChats(@Query('limit') limit?: string) {
    return this.adminService.getRecentChats(parseInt(limit || '20', 10));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get activity logs' })
  @ApiResponse({ status: 200, description: 'Activity logs returned' })
  async getActivityLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
  ) {
    return this.adminService.getActivityLogs(
      parseInt(page || '1', 10),
      parseInt(limit || '30', 10),
      action,
    );
  }

  @Post('activity/:id/undo')
  @ApiOperation({ summary: 'Undo an admin action' })
  @ApiResponse({ status: 200, description: 'Action undone successfully' })
  async undoActivity(
    @Param('id', ParseUUIDPipe) logId: string,
    @Request() req: any,
  ) {
    return this.adminService.undoActivity(logId, req.user.sub, req.user.email);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get site settings' })
  @ApiResponse({ status: 200, description: 'Settings returned' })
  async getSettings(@Query('prefix') prefix?: string): Promise<Record<string, string>> {
    return this.adminService.getSettings(prefix);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update site settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(
    @Body() dto: Record<string, string>,
    @Request() req: any,
  ): Promise<Record<string, string>> {
    const ALLOWED_PREFIXES = ['pricing.', 'feature.', 'display.', 'notification.', 'llm.'];
    const invalidKeys = Object.keys(dto).filter(
      (key) => !ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix)),
    );
    if (invalidKeys.length > 0) {
      throw new BadRequestException(`Invalid setting keys: ${invalidKeys.join(', ')}. Allowed prefixes: ${ALLOWED_PREFIXES.join(', ')}`);
    }
    return this.adminService.updateSettings(dto, req.user.sub, req.user.email);
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel a user subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancelSubscription(
    @Param('id', ParseUUIDPipe) subscriptionId: string,
    @Request() req: any,
  ) {
    return this.adminService.cancelSubscription(subscriptionId, req.user.sub, req.user.email);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get platform-wide analytics' })
  @ApiResponse({ status: 200, description: 'Analytics returned' })
  async getAnalytics(): Promise<PlatformAnalytics> {
    return this.adminService.getPlatformAnalytics();
  }

  @Get('analytics/llm-costs')
  @ApiOperation({ summary: 'Get top users by LLM spend' })
  @ApiResponse({ status: 200, description: 'LLM cost breakdown returned' })
  async getLlmCosts(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ): Promise<LlmCostRow[]> {
    return this.adminService.getLlmCostsByUser(
      parseInt(limit || '20', 10),
      parseInt(days || '30', 10),
    );
  }

  @Get('content/stats')
  @ApiOperation({ summary: 'Get content counts for the admin Content tab' })
  @ApiResponse({ status: 200, description: 'Content stats returned' })
  async getContentStats() {
    return this.adminService.getContentStats();
  }

  // ──────────────────────────────────────────────────────────────────
  // Cost Tab (Phase 1)
  // Every route here is guarded by JwtAuthGuard + AdminGuard at the
  // class level. The Cost tab fans out to these in parallel.
  // ──────────────────────────────────────────────────────────────────

  @Get('cost/summary')
  @ApiOperation({ summary: 'MTD spend, previous MTD, projection, and alert thresholds' })
  async getCostSummary() {
    return this.adminService.getCostSummary();
  }

  @Get('cost/by-feature')
  @ApiOperation({ summary: 'LLM spend grouped by feature tag' })
  async getCostByFeature(@Query('days') days?: string) {
    return this.adminService.getCostByFeature(parseInt(days || '30', 10));
  }

  @Get('cost/by-provider')
  @ApiOperation({ summary: 'LLM spend grouped by provider and model' })
  async getCostByProvider(@Query('days') days?: string) {
    return this.adminService.getCostByProvider(parseInt(days || '30', 10));
  }

  @Get('cost/daily')
  @ApiOperation({ summary: 'Daily LLM spend series (from stat_daily rollups)' })
  async getCostDaily(@Query('days') days?: string) {
    return this.adminService.getDailyCost(parseInt(days || '30', 10));
  }

  @Get('llm/usage/today')
  @ApiOperation({ summary: "Today's LLM tokens + cost, grouped by feature" })
  async getTodayLlmUsage() {
    return this.adminService.getTodayLlmUsage();
  }

  // ──────────────────────────────────────────────────────────────────
  // Stuck onboarding + Impersonation (Phase 1)
  // ──────────────────────────────────────────────────────────────────

  @Get('onboarding/stuck')
  @ApiOperation({ summary: 'Users who signed up ≤ 7d ago and never finished onboarding' })
  async getStuckOnboarding() {
    return this.adminService.getStuckOnboarding();
  }

  @Post('users/:id/impersonate')
  @ApiOperation({ summary: 'Mint a 1-hour impersonation JWT for the target user' })
  @ApiResponse({ status: 200, description: 'Token issued; activity logged' })
  async impersonateUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ): Promise<{ accessToken: string; expiresAt: string }> {
    return this.adminService.impersonateUser(userId, req.user.sub, req.user.email);
  }

  // ──────────────────────────────────────────────────────────────────
  // Growth & retention (Phase 2)
  // Every route here is guarded by JwtAuthGuard + AdminGuard at the
  // class level. FunnelTab + DashboardTab growth tiles fan out here.
  // ──────────────────────────────────────────────────────────────────

  @Get('funnel')
  @ApiOperation({ summary: 'Acquisition funnel counts by stage for a window + optional locale filter' })
  async getFunnel(
    @Query('days') days?: string,
    @Query('locale') locale?: string,
  ): Promise<FunnelCounts> {
    return this.growth.getFunnel({
      days: parseInt(days || '30', 10),
      locale: locale ?? null,
    });
  }

  @Get('cohorts')
  @ApiOperation({ summary: 'Weekly signup cohorts with retention grid (chat-session-based activity)' })
  async getCohorts(
    @Query('weeks') weeks?: string,
    @Query('locale') locale?: string,
  ): Promise<CohortRow[]> {
    return this.growth.getCohorts({
      weeks: parseInt(weeks || '12', 10),
      locale: locale ?? null,
    });
  }

  @Get('mrr')
  @ApiOperation({ summary: 'MRR / ARR / MoM delta / 6-month linear projection' })
  async getMrr(): Promise<MrrSnapshot & LtvArpuSnapshot> {
    const [mrr, ltv] = await Promise.all([this.growth.getMrr(), this.growth.getLtvArpu()]);
    return { ...mrr, ...ltv };
  }

  @Get('churn-risk')
  @ApiOperation({ summary: 'Premium users whose subscription renews in ≤14d and last chat was >14d ago' })
  async getChurnRisk(@Query('limit') limit?: string): Promise<ChurnRiskRow[]> {
    return this.growth.getChurnRisk({ limit: parseInt(limit || '50', 10) });
  }

  @Get('payment-failures')
  @ApiOperation({ summary: 'Payments in FAILED / REFUNDED status over the last N days' })
  async getPaymentFailures(@Query('days') days?: string): Promise<PaymentFailureRow[]> {
    return this.growth.getPaymentFailures({ days: parseInt(days || '30', 10) });
  }

  // ──────────────────────────────────────────────────────────────────
  // Ops health + kill-switch + broadcast (Phase 3)
  // ──────────────────────────────────────────────────────────────────

  @Get('ops/llm-health')
  @ApiOperation({ summary: 'LLM error rate + latency percentiles + cache hit rate in the window' })
  async getOpsLlmHealth(
    @Query('window') window?: string,
    @Query('by') by?: string,
  ): Promise<{
    errorRate: LlmErrorRateRow[];
    latencyByFeature: LatencyBucket[];
    latencyByProvider: LatencyBucket[];
    cacheHitRate: CacheHitRow[];
  }> {
    const hours = parseWindow(window);
    const groupBy = by === 'provider' ? 'provider' : 'feature';
    const [errorRate, latencyByFeature, latencyByProvider, cacheHitRate] = await Promise.all([
      this.ops.getLlmErrorRate(hours),
      this.ops.getLatencyPercentiles(hours, 'feature'),
      this.ops.getLatencyPercentiles(hours, 'provider'),
      this.ops.getCacheHitRate(hours),
    ]);
    // `groupBy` reserved for future dimension pivots; kept in the
    // signature so the client can ask for provider-primary views
    // without a breaking change.
    void groupBy;
    return { errorRate, latencyByFeature, latencyByProvider, cacheHitRate };
  }

  @Get('ops/queues')
  @ApiOperation({ summary: 'BullMQ queue depth across report / palmistry / broadcast' })
  async getOpsQueues(): Promise<QueueDepthRow[]> {
    return this.ops.getQueueDepths();
  }

  @Get('ops/health')
  @ApiOperation({ summary: 'DB + Redis service health readout (non-throwing)' })
  async getOpsHealth(): Promise<ServiceHealth> {
    return this.ops.getServiceHealth();
  }

  @Post('llm/provider/:name/disable')
  @ApiOperation({ summary: 'Kill-switch: disable an LLM provider (canonical key)' })
  async disableLlmProvider(
    @Param('name') name: string,
    @Request() req: any,
  ): Promise<{ enabled: boolean; provider: string }> {
    return this.adminService.setLlmProviderEnabled(name, false, req.user.sub, req.user.email);
  }

  @Post('llm/provider/:name/enable')
  @ApiOperation({ summary: 'Kill-switch: re-enable an LLM provider' })
  async enableLlmProvider(
    @Param('name') name: string,
    @Request() req: any,
  ): Promise<{ enabled: boolean; provider: string }> {
    return this.adminService.setLlmProviderEnabled(name, true, req.user.sub, req.user.email);
  }

  @Post('llm/keys/:provider/rotate')
  @ApiOperation({ summary: 'Rotate the stored API key for an LLM provider (30s reload)' })
  async rotateLlmKey(
    @Param('provider') provider: string,
    @Body() body: { key?: string },
    @Request() req: any,
  ): Promise<{ provider: string; rotatedAt: string }> {
    if (!KNOWN_LLM_PROVIDERS.has(provider)) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    if (key.length < 8) {
      throw new BadRequestException('New API key is too short to be valid');
    }
    return this.adminService.rotateLlmKey(provider, key, req.user.sub, req.user.email);
  }

  @Post('broadcast')
  @Throttle({ default: { ttl: 3_600_000, limit: 1 } })
  @ApiOperation({ summary: 'Enqueue a broadcast notification (1 per admin per hour)' })
  async createBroadcast(
    @Body() dto: BroadcastRequest,
    @Request() req: any,
  ): Promise<{ jobId: string; audienceSize: number }> {
    if (!dto?.audience?.type) {
      throw new BadRequestException('audience.type is required (all | premium | locale)');
    }
    return this.adminService.createBroadcast(dto, req.user.sub, req.user.email);
  }

  @Post('users/:id/force-logout')
  @ApiOperation({ summary: 'Invalidate every refresh-token family for a user' })
  async forceLogoutUser(
    @Param('id', ParseUUIDPipe) userId: string,
    @Request() req: any,
  ): Promise<{ familiesRevoked: number }> {
    return this.adminService.forceLogoutUser(userId, req.user.sub, req.user.email);
  }
}

/** Clamp the `window` query to one of the three allowed buckets. */
function parseWindow(w: string | undefined): number {
  const n = parseInt(w || '1', 10);
  if (n >= 168) return 168; // 7d
  if (n >= 24) return 24;
  return 1;
}
