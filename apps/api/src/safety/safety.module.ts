import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { SafetyService } from './safety.service';

/**
 * Phase 4 safety module. Exports ModerationService so ChatService can
 * call it on every new user message, and SafetyService so
 * AdminService/AdminController can fan the admin review queue out of it.
 *
 * No @Global — we'd rather the dependents import explicitly so the
 * module graph stays navigable.
 */
@Module({
  providers: [ModerationService, SafetyService],
  exports: [ModerationService, SafetyService],
})
export class SafetyModule {}
