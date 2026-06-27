import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { UserModule } from '../user/user.module';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';

@Module({
  imports: [UserModule, FeatureAccessModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentReconcileService],
  exports: [PaymentService],
})
export class PaymentModule {}
