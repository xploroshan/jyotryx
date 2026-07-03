import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService, UserProfile, UpdateProfileDto, UserCredits } from './user.service';
import { PushService } from './push.service';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './dto/push-token.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly pushService: PushService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: JwtPayload): Promise<UserProfile> {
    return this.userService.getProfile(user.sub);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    return this.userService.updateProfile(user.sub, dto);
  }

  @Get('me/credits')
  @ApiOperation({ summary: 'Get current user credit balance' })
  @ApiResponse({ status: 200, description: 'Credit balance returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCredits(@CurrentUser() user: JwtPayload): Promise<UserCredits> {
    return this.userService.getCredits(user.sub);
  }

  @Post('push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register an FCM device token for push notifications' })
  @ApiResponse({ status: 200, description: 'Token registered' })
  async registerPushToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<{ registered: boolean }> {
    return this.pushService.registerToken(user.sub, dto.token, dto.platform ?? 'android');
  }

  // POST rather than DELETE-with-body: some proxies strip DELETE bodies.
  @Post('push-token/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister an FCM device token (logout / device handoff)' })
  @ApiResponse({ status: 200, description: 'Token removed (or was not registered)' })
  async unregisterPushToken(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UnregisterPushTokenDto,
  ): Promise<{ removed: boolean }> {
    return this.pushService.unregisterToken(user.sub, dto.token);
  }
}
