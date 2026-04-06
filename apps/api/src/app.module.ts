import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { OpenAIModule } from './openai/openai.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ChatModule } from './modules/chat/chat.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    PrismaModule,
    OpenAIModule,
    AuthModule,
    UserModule,
    ChatModule,
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
