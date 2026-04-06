import { Module } from '@nestjs/common';
import { VastuController } from './vastu.controller';
import { VastuService } from './vastu.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [UserModule, KnowledgeModule],
  controllers: [VastuController],
  providers: [VastuService],
  exports: [VastuService],
})
export class VastuModule {}
