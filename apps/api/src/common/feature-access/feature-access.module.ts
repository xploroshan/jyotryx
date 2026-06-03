import { Module } from '@nestjs/common';
import { FeatureAccessService } from './feature-access.service';

/**
 * Shared monetization gate. PrismaModule is global, so this module only
 * needs to provide and export the service for the paid-feature modules
 * (Report, Palmistry, Chat, Payment) to consume.
 */
@Module({
  providers: [FeatureAccessService],
  exports: [FeatureAccessService],
})
export class FeatureAccessModule {}
