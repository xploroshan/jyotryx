import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PushService } from './push.service';

@Module({
  controllers: [UserController],
  providers: [UserService, PushService],
  exports: [UserService, PushService],
})
export class UserModule {}
