import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { CreateOrderDto, VerifyPaymentDto, CreateSubscriptionDto } from './dto';

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  receipt: string;
  createdAt: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  paymentId: string;
  orderId: string;
  creditsAdded?: number;
}

export interface SubscriptionResult {
  id: string;
  planId: string;
  status: string;
  currentStart: string;
  currentEnd: string;
}

export interface PaymentHistoryItem {
  id: string;
  orderId: string | null;
  amount: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private razorpayInstance: any = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
  ) {
    this.initRazorpay();
  }

  private initRazorpay(): void {
    const keyId = this.configService.get<string>('razorpay.keyId');
    const keySecret = this.configService.get<string>('razorpay.keySecret');

    if (keyId && keySecret) {
      try {
        const Razorpay = require('razorpay');
        this.razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
        this.logger.log('Razorpay initialized successfully');
      } catch {
        this.logger.warn('Razorpay initialization failed, using mock mode');
      }
    } else {
      this.logger.warn('Razorpay credentials not configured, using mock mode');
    }
  }

  async createOrder(userId: string, dto: CreateOrderDto): Promise<RazorpayOrder> {
    this.logger.log(`Creating order for user: ${userId}, amount: ${dto.amount}`);

    let orderId: string;
    let orderAmount = dto.amount;
    let orderCurrency = dto.currency || 'INR';

    if (this.razorpayInstance) {
      try {
        const order = await this.razorpayInstance.orders.create({
          amount: dto.amount,
          currency: dto.currency || 'INR',
          receipt: `rcpt_${crypto.randomUUID().substring(0, 8)}`,
          notes: { userId, productId: dto.productId, description: dto.description || '' },
        });
        orderId = order.id;
        orderAmount = order.amount;
        orderCurrency = order.currency;
      } catch (error) {
        this.logger.error('Razorpay order creation failed', error);
        throw new InternalServerErrorException('Failed to create payment order');
      }
    } else {
      orderId = `order_mock_${crypto.randomUUID().substring(0, 14)}`;
    }

    // Persist to DB
    await this.prisma.payment.create({
      data: {
        userId,
        amount: orderAmount / 100, // Convert paise to rupees
        currency: orderCurrency,
        status: 'PENDING',
        razorpayOrderId: orderId,
        type: 'CREDITS',
        metadata: { productId: dto.productId, description: dto.description },
      },
    });

    return {
      id: orderId,
      entity: 'order',
      amount: orderAmount,
      currency: orderCurrency,
      status: 'created',
      receipt: `rcpt_${crypto.randomUUID().substring(0, 8)}`,
      createdAt: new Date().toISOString(),
    };
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto): Promise<PaymentVerificationResult> {
    this.logger.log(`Verifying payment for user: ${userId}, order: ${dto.razorpayOrderId}`);

    const webhookSecret = this.configService.get<string>('razorpay.keySecret');

    if (webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== dto.razorpaySignature) {
        throw new BadRequestException('Payment verification failed: invalid signature');
      }
    }

    // Update payment in DB
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: dto.razorpayOrderId },
    });

    if (payment) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          razorpayPaymentId: dto.razorpayPaymentId,
        },
      });

      // Add credits based on the amount paid
      const creditsToAdd = this.calculateCredits(Number(payment.amount));
      await this.userService.addCredits(userId, creditsToAdd, 'PURCHASE', `Purchased ${creditsToAdd} credits`);

      return {
        verified: true,
        paymentId: dto.razorpayPaymentId,
        orderId: dto.razorpayOrderId,
        creditsAdded: creditsToAdd,
      };
    }

    return {
      verified: true,
      paymentId: dto.razorpayPaymentId,
      orderId: dto.razorpayOrderId,
    };
  }

  async createSubscription(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResult> {
    this.logger.log(`Creating subscription for user: ${userId}, plan: ${dto.planId}`);

    let subscriptionId: string;

    if (this.razorpayInstance) {
      try {
        const subscription = await this.razorpayInstance.subscriptions.create({
          plan_id: dto.planId,
          total_count: dto.totalCount ? parseInt(dto.totalCount) : 12,
          notes: { userId },
        });
        subscriptionId = subscription.id;
      } catch (error) {
        this.logger.error('Razorpay subscription creation failed', error);
        throw new InternalServerErrorException('Failed to create subscription');
      }
    } else {
      subscriptionId = `sub_mock_${crypto.randomUUID().substring(0, 14)}`;
    }

    // Persist subscription
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.prisma.subscription.create({
      data: {
        userId,
        plan: dto.planId.includes('annual') ? 'ANNUAL' : 'MONTHLY',
        status: 'ACTIVE',
        razorpaySubscriptionId: subscriptionId,
        endDate,
      },
    });

    // Upgrade user role
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'PREMIUM' },
    });

    return {
      id: subscriptionId,
      planId: dto.planId,
      status: 'active',
      currentStart: new Date().toISOString(),
      currentEnd: endDate.toISOString(),
    };
  }

  async handleWebhook(payload: Record<string, any>): Promise<{ received: boolean }> {
    this.logger.log(`Webhook received: ${payload?.event || 'unknown event'}`);

    const event = payload?.event;
    const paymentEntity = payload?.payload?.payment?.entity;

    switch (event) {
      case 'payment.captured':
        if (paymentEntity?.order_id) {
          await this.prisma.payment.updateMany({
            where: { razorpayOrderId: paymentEntity.order_id },
            data: { status: 'SUCCESS', razorpayPaymentId: paymentEntity.id },
          });
        }
        break;
      case 'payment.failed':
        if (paymentEntity?.order_id) {
          await this.prisma.payment.updateMany({
            where: { razorpayOrderId: paymentEntity.order_id },
            data: { status: 'FAILED' },
          });
        }
        break;
      case 'subscription.charged':
        this.logger.log('Subscription charge successful');
        break;
      case 'subscription.cancelled':
        const subEntity = payload?.payload?.subscription?.entity;
        if (subEntity?.id) {
          await this.prisma.subscription.updateMany({
            where: { razorpaySubscriptionId: subEntity.id },
            data: { status: 'CANCELLED' },
          });
        }
        break;
    }

    return { received: true };
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistoryItem[]> {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return payments.map((p) => ({
      id: p.id,
      orderId: p.razorpayOrderId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  private calculateCredits(amountINR: number): number {
    if (amountINR >= 699) return 100;
    if (amountINR >= 399) return 50;
    if (amountINR >= 99) return 10;
    return Math.max(1, Math.floor(amountINR / 10));
  }
}
