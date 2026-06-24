import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DailyBriefingService, DailyBriefingResult, PlanetaryHour } from './daily-briefing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';
import { DEFAULT_TZ, isValidTimeZone, zonedNow } from '../../common/timezone.util';

@ApiTags('Daily Briefing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('daily-briefing')
export class DailyBriefingController {
  constructor(private readonly dailyBriefingService: DailyBriefingService) {}

  @Get()
  @ApiOperation({ summary: 'Get personalized daily briefing (Good Morning + My Day)' })
  @ApiQuery({ name: 'locale', required: false, description: 'Language locale (e.g. hi, ta, bn)' })
  @ApiQuery({ name: 'tz', required: false, description: "IANA timezone of the caller (e.g. Asia/Kolkata). Decides which day & greeting the briefing reflects; defaults to the user's birthplace zone, then Asia/Kolkata." })
  async getDailyBriefing(
    @CurrentUser() user: JwtPayload,
    @Query('locale') locale?: string,
    @Query('tz') tz?: string,
  ): Promise<DailyBriefingResult> {
    return this.dailyBriefingService.getDailyBriefing(user.sub, locale, tz);
  }

  @Get('planetary-hours')
  @Public()
  @ApiOperation({ summary: 'Get today\'s planetary hours (public)' })
  @ApiQuery({ name: 'tz', required: false, description: 'IANA timezone (defaults to Asia/Kolkata)' })
  async getPlanetaryHours(@Query('tz') tz?: string): Promise<PlanetaryHour[]> {
    return this.dailyBriefingService.getPlanetaryHoursOnly(tz);
  }

  @Get('offline-pack')
  @Public()
  @ApiOperation({ summary: 'Get daily offline data package (panchang + planetary hours + day quality) for mobile/offline sync' })
  @ApiQuery({ name: 'tz', required: false, description: 'IANA timezone (defaults to Asia/Kolkata)' })
  async getOfflinePack(@Query('tz') tz?: string): Promise<{
    date: string;
    planetaryHours: PlanetaryHour[];
    panchang: any;
    generatedAt: string;
  }> {
    const z = zonedNow(new Date(), isValidTimeZone(tz) ? tz : DEFAULT_TZ);
    const planetaryHours = await this.dailyBriefingService.getPlanetaryHoursOnly(z.zone);
    return {
      date: z.dateStr,
      planetaryHours,
      panchang: {
        // Basic panchang computed server-side for accuracy (in the caller's zone)
        vara: ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'][z.weekday],
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
