import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyBriefingService, DailyBriefingResult, PlanetaryHour } from './daily-briefing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';

@ApiTags('Daily Briefing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('daily-briefing')
export class DailyBriefingController {
  constructor(private readonly dailyBriefingService: DailyBriefingService) {}

  @Get()
  @ApiOperation({ summary: 'Get personalized daily briefing (Good Morning + My Day)' })
  async getDailyBriefing(@CurrentUser() user: JwtPayload): Promise<DailyBriefingResult> {
    return this.dailyBriefingService.getDailyBriefing(user.sub);
  }

  @Get('planetary-hours')
  @Public()
  @ApiOperation({ summary: 'Get today\'s planetary hours (public)' })
  async getPlanetaryHours(): Promise<PlanetaryHour[]> {
    return this.dailyBriefingService.getPlanetaryHoursOnly();
  }
}
