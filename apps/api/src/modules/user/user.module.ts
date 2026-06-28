import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';

@Module({
  imports: [FeatureAccessModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
