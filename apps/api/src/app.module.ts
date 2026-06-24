import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import Redis from 'ioredis';
import { ConditionalThrottlerGuard } from './common/guards/conditional-throttler.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';
import { RedisModule, REDIS_CLIENT } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { OpenAIModule } from './openai/openai.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { MemoryModule } from './modules/memory/memory.module';
import { AstrologyModule } from './modules/astrology/astrology.module';
import { PalmistryModule } from './modules/palmistry/palmistry.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReportModule } from './modules/report/report.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AdminModule } from './modules/admin/admin.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { DailyBriefingModule } from './modules/daily-briefing/daily-briefing.module';
import { NumerologyModule } from './modules/numerology/numerology.module';
import { TarotModule } from './modules/tarot/tarot.module';
import { VastuModule } from './modules/vastu/vastu.module';
import { ReferralModule } from './modules/referral/referral.module';
import { ExperimentModule } from './modules/experiment/experiment.module';
import { StorageModule } from './storage/storage.module';
import { EphemerisModule } from './ephemeris/ephemeris.module';
import { PartitionModule } from './partition/partition.module';
import { StatsModule } from './stats/stats.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AppLoggerModule } from './common/logger/logger.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    AppLoggerModule,
    MetricsModule,
    RedisModule,
    StorageModule,
    EphemerisModule,
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => {
        // ThrottlerGuard runs on every request (registered as APP_GUARD
        // below). With a Redis-backed store, a rate-limited or
        // unreachable Upstash makes every request 500 — including
        // Railway's healthcheck, which then never sees a 200 and the
        // deploy stays unrouted. When DISABLE_QUEUES=true we fall back
        // to in-memory throttling (per-replica, so the limit is softer,
        // but the API actually serves traffic).
        const disable = (process.env.DISABLE_QUEUES ?? '').toLowerCase() === 'true';
        return {
          throttlers: [{ ttl: 60000, limit: 60 }],
          ...(disable ? {} : { storage: new ThrottlerStorageRedisService(redis) }),
        };
      },
    }),
    PrismaModule,
    OpenAIModule,
    HealthModule,
    AuthModule,
    UserModule,
    ChatModule,
    MemoryModule,
    AstrologyModule,
    PalmistryModule,
    PaymentModule,
    ReportModule,
    NotificationModule,
    AdminModule,
    KnowledgeModule,
    DailyBriefingModule,
    NumerologyModule,
    TarotModule,
    VastuModule,
    ReferralModule,
    ExperimentModule,
    PartitionModule,
    StatsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      // Throttling is fully active in prod/dev; the guard only steps aside
      // when THROTTLE_DISABLED=true (set solely by the real-API E2E harness).
      useClass: ConditionalThrottlerGuard,
    },
    {
      // Authenticate EVERY route by default. Routes that must stay open
      // opt out with `@Public()` (auth, health, pricing, webhook, public
      // experiment/numerology/astrology endpoints, etc.). This closes the
      // fail-open gap where a controller missing `@UseGuards(JwtAuthGuard)`
      // was silently unauthenticated.
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
