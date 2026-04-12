import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PartitionService } from './partition.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [PartitionService],
})
export class PartitionModule {}
