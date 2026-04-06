import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TarotService } from './tarot.service';
import { DrawCardsDto } from './dto/draw-cards.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Tarot')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tarot')
export class TarotController {
  constructor(private readonly tarotService: TarotService) {}

  @Post('draw')
  @ApiOperation({ summary: 'Draw tarot cards for a reading' })
  @ApiResponse({ status: 201, description: 'Tarot reading generated' })
  async drawCards(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DrawCardsDto,
  ) {
    return this.tarotService.drawCards(user.sub, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get tarot reading history' })
  @ApiResponse({ status: 200, description: 'Reading history returned' })
  async getHistory(@CurrentUser() user: JwtPayload) {
    return this.tarotService.getHistory(user.sub);
  }
}
