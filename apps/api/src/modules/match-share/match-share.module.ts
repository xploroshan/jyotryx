import { Module } from '@nestjs/common';
import { MatchShareService } from './match-share.service';
import { MatchShareController } from './match-share.controller';

@Module({
  controllers: [MatchShareController],
  providers: [MatchShareService],
  exports: [MatchShareService],
})
export class MatchShareModule {}
