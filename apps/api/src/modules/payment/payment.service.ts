import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
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
  orderId: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed' | 'refunded';
  productId: string;
  description: string;
  createdAt: string;
}

// In-memory store for development
const ordersStore: Map<string, PaymentHistoryItem> = new Map();

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private razorpayInstance: any = null;

  constructor(private configService: ConfigService) {
    this.initRazorpay();
  }

  private initRazorpay(): void {
    const keyId = this.configService.get<string>('razorpay.keyId');
    const keySecret = this.configService.get<string>('razorpay.keySecret');

    if (keyId && keySecret) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Razorpay = require('razorpay');
        this.razorpayInstance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        this.logger.log('Razorpay initialized successfully');
      } catch (error) {
        this.logger.warn('Razorpay initialization failed, using mock mode');
      }
    } else {
      this.logger.warn('Razorpay credentials not configured, using mock mode');
    }
  }

  async createOrder(userId: string, dto: CreateOrderDto): Promise<RazorpayOrder> {
    this.logger.log(`Creating order for user: ${userId}, amount: ${dto.amount}`);

    if (this.razorpayInstance) {
      try {
        const order = await this.razorpayInstance.orders.create({
          amount: dto.amount,
          currency: dto.currency || 'INR',
          receipt: `rcpt_${uuidv4().substring(0, 8)}`,
          notes: {
            userId,
            productId: dto.productId,
            description: dto.description || '',
          },
        });

        const historyItem: PaymentHistoryItem = {
          id: uuidv4(),
          orderId: order.id,
          amount: dto.amount,
          currency: dto.currency || 'INR',
          status: 'created',
          productId: dto.productId,
          description: dto.description || '',
          createdAt: new Date().toISOString(),
        };
        ordersStore.set(order.id, historyItem);

        return {
          id: order.id,
          entity: 'order',
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          receipt: order.receipt,
          createdAt: new Date().toISOString(),
        };
      } catch (error) {
        this.logger.error('Razorpay order creation failed', error);
        throw new InternalServerErrorException('Failed to create payment order');
      }
    }

    // Mock mode
    const mockOrderId = `order_${uuidv4().substring(0, 14)}`;
    const historyItem: PaymentHistoryItem = {
      id: uuidv4(),
      orderId: mockOrderId,
      amount: dto.amount,
      currency: dto.currency || 'INR',
      status: 'created',
      productId: dto.productId,
      description: dto.description || '',
      createdAt: new Date().toISOString(),
    };
    ordersStore.set(mockOrderId, historyItem);

    return {
      id: mockOrderId,
      entity: 'order',
      amount: dto.amount,
      currency: dto.currency || 'INR',
      status: 'created',
      receipt: `rcpt_${uuidv4().substring(0, 8)}`,
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

    // Update order status
    const order = ordersStore.get(dto.razorpayOrderId);
    if (order) {
      order.status = 'paid';
    }

    // TODO: Add credits to user account based on productId
    const creditsAdded = 50; // Mock

    return {
      verified: true,
      paymentId: dto.razorpayPaymentId,
      orderId: dto.razorpayOrderId,
      creditsAdded,
    };
  }

  async createSubscription(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResult> {
    this.logger.log(`Creating subscription for user: ${userId}, plan: ${dto.planId}`);

    if (this.razorpayInstance) {
      try {
        const subscription = await this.razorpayInstance.subscriptions.create({
          plan_id: dto.planId,
          total_count: dto.totalCount ? parseInt(dto.totalCount) : 12,
          notes: { userId },
        });

        return {
          id: subscription.id,
          planId: dto.planId,
          status: subscription.status,
          currentStart: new Date().toISOString(),
          currentEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
      } catch (error) {
        this.logger.error('Razorpay subscription creation failed', error);
        throw new InternalServerErrorException('Failed to create subscription');
      }
    }

    // Mock mode
    return {
      id: `sub_${uuidv4().substring(0, 14)}`,
      planId: dto.planId,
      status: 'created',
      currentStart: new Date().toISOString(),
      currentEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async handleWebhook(payload: Record<string, any>): Promise<{ received: boolean }> {
    this.logger.log(`Webhook received: ${payload?.event || 'unknown event'}`);

    // TODO: Verify webhook signature
    // TODO: Handle different event types (payment.captured, subscription.charged, etc.)

    const event = payload?.event;
    switch (event) {
      case 'payment.captured':
        this.logger.log('Payment captured successfully');
        break;
      case 'payment.failed':
        this.logger.warn('Payment failed');
        break;
      case 'subscription.charged':
        this.logger.log('Subscription charge successful');
        break;
      case 'subscription.cancelled':
        this.logger.warn('Subscription cancelled');
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${event}`);
    }

    return { received: true };
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistoryItem[]> {
    this.logger.log(`Fetching payment history for user: ${userId}`);

    // TODO: Replace with Prisma query filtered by userId
    return Array.from(ordersStore.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
