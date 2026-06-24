import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  PaymentService,
  RazorpayOrder,
  PaymentVerificationResult,
  SubscriptionResult,
  PaymentHistoryItem,
} from './payment.service';
import { CreateOrderDto, VerifyPaymentDto, CreateSubscriptionDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('pricing')
  @Public()
  @ApiOperation({ summary: 'Get public pricing configuration' })
  @ApiResponse({ status: 200, description: 'Pricing config returned' })
  async getPricing(): Promise<Record<string, string>> {
    return this.paymentService.getPricingConfig();
  }

  @Post('create-order')
  @ApiOperation({ summary: 'Create a Razorpay payment order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  async createOrder(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateOrderDto,
  ): Promise<RazorpayOrder> {
    return this.paymentService.createOrder(user.sub, dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Razorpay payment after completion' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  async verifyPayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyPaymentDto,
  ): Promise<PaymentVerificationResult> {
    return this.paymentService.verifyPayment(user.sub, dto);
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Create a Razorpay subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created successfully' })
  async createSubscription(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResult> {
    return this.paymentService.createSubscription(user.sub, dto);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: Record<string, any>,
    @Headers('x-razorpay-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    // Pass the exact raw bytes Razorpay signed so the signature is verified
    // against them, not a re-serialization of the parsed body.
    return this.paymentService.handleWebhook(payload, signature, req.rawBody);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get payment history for current user' })
  @ApiResponse({ status: 200, description: 'Payment history returned' })
  async getPaymentHistory(
    @CurrentUser() user: JwtPayload,
  ): Promise<PaymentHistoryItem[]> {
    return this.paymentService.getPaymentHistory(user.sub);
  }
}
