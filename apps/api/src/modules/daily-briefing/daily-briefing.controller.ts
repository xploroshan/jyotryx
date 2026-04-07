import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'locale', required: false, description: 'Language locale (e.g. hi, ta, bn)' })
  async getDailyBriefing(@CurrentUser() user: JwtPayload, @Query('locale') locale?: string): Promise<DailyBriefingResult> {
    return this.dailyBriefingService.getDailyBriefing(user.sub, locale);
  }

  @Get('planetary-hours')
  @Public()
  @ApiOperation({ summary: 'Get today\'s planetary hours (public)' })
  async getPlanetaryHours(): Promise<PlanetaryHour[]> {
    return this.dailyBriefingService.getPlanetaryHoursOnly();
  }

  @Get('offline-pack')
  @Public()
  @ApiOperation({ summary: 'Get daily offline data package (panchang + planetary hours + day quality) for mobile/offline sync' })
  async getOfflinePack(): Promise<{
    date: string;
    planetaryHours: PlanetaryHour[];
    panchang: any;
    generatedAt: string;
  }> {
    const planetaryHours = await this.dailyBriefingService.getPlanetaryHoursOnly();
    return {
      date: new Date().toISOString().split('T')[0],
      planetaryHours,
      panchang: {
        // Basic panchang computed server-side for accuracy
        vara: ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'][new Date().getDay()],
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
