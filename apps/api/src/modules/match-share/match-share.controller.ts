import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MatchShareService } from './match-share.service';
import { CreateShareDto } from './dto/create-share.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';

@ApiTags('Match Share')
@UseGuards(JwtAuthGuard)
@Controller('astrology/matching')
export class MatchShareController {
  constructor(private readonly matchShareService: MatchShareService) {}

  @Post('share')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create a public shareable link for a Kundli-match result' })
  @ApiResponse({ status: 201, description: 'Share created; returns the public token' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateShareDto) {
    return this.matchShareService.create(user.sub, dto);
  }

  @Get('shared/:token')
  @Public()
  @ApiOperation({ summary: 'Fetch a publicly shared match result by token' })
  @ApiResponse({ status: 200, description: 'Shared match returned' })
  getByToken(@Param('token') token: string) {
    return this.matchShareService.getByToken(token);
  }
}
