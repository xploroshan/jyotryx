import { Module } from '@nestjs/common';
import { PalmistryController } from './palmistry.controller';
import { PalmistryService } from './palmistry.service';

@Module({
  controllers: [PalmistryController],
  providers: [PalmistryService],
  exports: [PalmistryService],
})
export class PalmistryModule {}
