import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { UserModule } from '../user/user.module';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';

@Module({
  imports: [UserModule, FeatureAccessModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
