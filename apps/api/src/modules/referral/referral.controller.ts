import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ReferralService, ReferralStatus } from './referral.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/current-user.decorator';

@ApiTags('Referral')
@Controller('referral')
export class ReferralController {
  constructor(
    private readonly referralService: ReferralService,
    private readonly configService: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get the current user\'s referral code, share URL and history' })
  @ApiResponse({ status: 200, description: 'Referral status returned' })
  async getMyReferralStatus(@Request() req: any): Promise<ReferralStatus> {
    const baseUrl = this.configService.get<string>('frontendUrl') || 'https://www.jyotron.com';
    return this.referralService.getStatusForUser(req.user.sub, baseUrl);
  }

  @Get('preview')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @ApiOperation({ summary: 'Preview a referral code (used by the signup page banner)' })
  @ApiResponse({ status: 200, description: 'Referral preview or {valid:false} when unknown' })
  async previewCode(
    @Query('code') code?: string,
  ): Promise<
    | { valid: false }
    | { valid: true; referrerName: string; bonusDays: number }
  > {
    const result = await this.referralService.previewCode(code || '');
    return result ? { valid: true, ...result } : { valid: false };
  }
}
