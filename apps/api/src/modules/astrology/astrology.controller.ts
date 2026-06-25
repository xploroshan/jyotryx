import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  AstrologyService,
  BirthDetails,
  KundliResult,
  MatchingResult,
  HoroscopeResult,
  PanchangResult,
  MuhuratResult,
  DoshaResult,
  TimingDecisionRequest,
  TimingDecisionResult,
  CosmicCalendarResult,
} from './astrology.service';
import { MuhuratRequestDto } from './dto/muhurat-request.dto';
import { DecisionActivity } from './decision-rules';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';

@ApiTags('Astrology')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('astrology')
export class AstrologyController {
  constructor(private readonly astrologyService: AstrologyService) {}

  @Post('kundli')
  @ApiOperation({ summary: 'Generate a Kundli (birth chart)' })
  @ApiResponse({ status: 201, description: 'Kundli generated successfully' })
  async generateKundli(
    @CurrentUser() user: JwtPayload,
    @Body() birthDetails: BirthDetails & { locale?: string },
  ): Promise<KundliResult> {
    return this.astrologyService.generateKundli(user.sub, birthDetails, birthDetails.locale);
  }

  @Post('matching')
  @ApiOperation({ summary: 'Perform Kundli matching (Ashtakoot Guna)' })
  @ApiResponse({ status: 201, description: 'Matching result generated' })
  async getMatching(
    @CurrentUser() user: JwtPayload,
    @Body() body: { partner1: BirthDetails; partner2: BirthDetails; locale?: string },
  ): Promise<MatchingResult> {
    return this.astrologyService.getMatching(user.sub, body.partner1, body.partner2, body.locale);
  }

  @Get('traditions')
  @Public()
  @ApiOperation({ summary: 'Get available astrology traditions' })
  @ApiResponse({ status: 200, description: 'Traditions returned' })
  getAvailableTraditions() {
    return this.astrologyService.getAvailableTraditions();
  }

  @Get('horoscope/:sign')
  @Public()
  @ApiOperation({ summary: 'Get horoscope for a zodiac sign' })
  @ApiResponse({ status: 200, description: 'Horoscope returned' })
  async getHoroscope(
    @Param('sign') sign: string,
    @Query('period') period?: string,
    @Query('locale') locale?: string,
    @Query('tradition') tradition?: string,
  ): Promise<HoroscopeResult> {
    return this.astrologyService.getHoroscope(sign, period as any, locale, tradition);
  }

  @Get('horoscope/:sign/multi')
  @Public()
  @ApiOperation({ summary: 'Get multi-tradition horoscope for a zodiac sign' })
  @ApiResponse({ status: 200, description: 'Multi-tradition horoscope returned' })
  async getMultiTraditionHoroscope(
    @Param('sign') sign: string,
    @Query('period') period?: string,
    @Query('locale') locale?: string,
    @Query('traditions') traditions?: string,
  ) {
    const traditionList = traditions?.split(',').map(t => t.trim().toUpperCase()) || ['VEDIC'];
    return this.astrologyService.getMultiTraditionHoroscope(
      sign,
      (period as any) || 'daily',
      traditionList,
      locale,
    );
  }

  @Get('chinese-zodiac/:year')
  @Public()
  @ApiOperation({ summary: 'Get Chinese zodiac for a birth year' })
  @ApiResponse({ status: 200, description: 'Chinese zodiac returned' })
  getChineseZodiac(@Param('year') year: string, @Query('locale') locale?: string) {
    return this.astrologyService.getChineseZodiac(parseInt(year, 10), locale);
  }

  @Get('panchang')
  @Public()
  @ApiOperation({ summary: 'Get today\'s Panchang (Hindu calendar details)' })
  @ApiResponse({ status: 200, description: 'Panchang details returned' })
  async getPanchang(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('locale') locale?: string,
  ): Promise<PanchangResult> {
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    return this.astrologyService.getPanchang(latitude, longitude, locale);
  }

  @Post('muhurat')
  @ApiOperation({ summary: 'Find auspicious muhurat times' })
  @ApiResponse({ status: 201, description: 'Muhurat times returned' })
  async getMuhurat(@Body() dto: MuhuratRequestDto): Promise<MuhuratResult> {
    return this.astrologyService.getMuhurat(dto);
  }

  @Post('timing-decision')
  @Public()
  @ApiOperation({ summary: 'Decision Room — score a date/time for an activity (Muhurta)' })
  @ApiResponse({ status: 201, description: 'Timing decision returned' })
  getTimingDecision(@Body() dto: TimingDecisionRequest): TimingDecisionResult {
    return this.astrologyService.getTimingDecision(dto);
  }

  @Get('cosmic-calendar')
  @Public()
  @ApiOperation({ summary: 'Cosmic Calendar — per-day auspiciousness for a month' })
  @ApiResponse({ status: 200, description: 'Cosmic calendar returned' })
  async getCosmicCalendar(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('activity') activity?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('location') location?: string,
  ): Promise<CosmicCalendarResult> {
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getUTCFullYear();
    const m = month ? parseInt(month, 10) : now.getUTCMonth() + 1;
    const latitude = lat ? parseFloat(lat) : undefined;
    const longitude = lng ? parseFloat(lng) : undefined;
    return this.astrologyService.getCosmicCalendar(
      y,
      m,
      (activity as DecisionActivity) || 'general',
      latitude,
      longitude,
      location,
    );
  }

  @Get('dosha')
  @ApiOperation({ summary: 'Get dosha analysis for current user' })
  @ApiResponse({ status: 200, description: 'Dosha analysis returned' })
  async getDosha(
    @CurrentUser() user: JwtPayload,
    @Query('locale') locale?: string,
  ): Promise<DoshaResult> {
    return this.astrologyService.getDosha(user.sub, locale);
  }

  @Get('sade-sati')
  @ApiOperation({ summary: 'Get Sade Sati analysis for current user' })
  @ApiResponse({ status: 200, description: 'Sade Sati analysis returned' })
  async getSadeSati(
    @CurrentUser() user: JwtPayload,
    @Query('locale') locale?: string,
  ) {
    return this.astrologyService.getSadeSati(user.sub, locale);
  }

  @Post('divisional/:type')
  @ApiOperation({ summary: 'Generate divisional chart (D9 Navamsa, D10 Dashamsha, etc.)' })
  @ApiResponse({ status: 201, description: 'Divisional chart generated' })
  async getDivisionalChart(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
    @Body() birthDetails: BirthDetails,
  ) {
    return this.astrologyService.getDivisionalChart(user.sub, birthDetails, type);
  }

  @Post('kp-chart')
  @ApiOperation({ summary: 'Generate KP (Krishnamurti Paddhati) chart' })
  @ApiResponse({ status: 201, description: 'KP chart generated' })
  async generateKPChart(
    @CurrentUser() user: JwtPayload,
    @Body() birthDetails: BirthDetails,
  ) {
    return this.astrologyService.generateKPChart(user.sub, birthDetails);
  }

  // ─── Tradition-specific feature routes ──────────────────────────────────

  @Post('bazi')
  @ApiOperation({ summary: 'Chinese BaZi (Four Pillars of Destiny)' })
  @ApiResponse({ status: 201, description: 'BaZi pillars returned' })
  async getBazi(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { dateOfBirth: string; timeOfBirth: string; placeOfBirth?: string; locale?: string },
  ) {
    return this.astrologyService.getBazi(user.sub, dto);
  }

  @Post('western/natal')
  @ApiOperation({ summary: 'Western tropical natal chart' })
  @ApiResponse({ status: 201, description: 'Western natal chart returned' })
  async getWesternNatal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { dateOfBirth: string; timeOfBirth: string; placeOfBirth?: string; locale?: string },
  ) {
    return this.astrologyService.getWesternNatal(user.sub, dto);
  }

  @Post('hellenistic/profections')
  @ApiOperation({ summary: 'Hellenistic annual profections' })
  @ApiResponse({ status: 201, description: 'Annual profection returned' })
  async getHellenisticProfections(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { dateOfBirth: string; locale?: string },
  ) {
    return this.astrologyService.getHellenisticProfections(user.sub, dto);
  }

  @Post('horary/ask')
  @ApiOperation({ summary: 'Horary chart + judgment for a question asked now' })
  @ApiResponse({ status: 201, description: 'Horary judgment returned' })
  async getHoraryAsk(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { question: string; locale?: string },
  ) {
    return this.astrologyService.getHoraryAsk(user.sub, dto);
  }

  @Get('medical/body-zodiac')
  @Public()
  @ApiOperation({ summary: 'Medical astrology zodiac-body correspondence table' })
  @ApiResponse({ status: 200, description: 'Body-zodiac mapping returned' })
  getMedicalBodyZodiac(@Query('locale') locale?: string) {
    return this.astrologyService.getMedicalBodyZodiac(locale);
  }

  @Post('western/synastry')
  @ApiOperation({ summary: 'Western synastry — compare two natal charts' })
  @ApiResponse({ status: 201, description: 'Synastry comparison returned' })
  async getWesternSynastry(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      partner1: { dateOfBirth: string; timeOfBirth: string };
      partner2: { dateOfBirth: string; timeOfBirth: string };
      locale?: string;
    },
  ) {
    return this.astrologyService.getWesternSynastry(user.sub, dto);
  }

  @Post('western/transits')
  @ApiOperation({ summary: 'Current western transits to a natal chart' })
  @ApiResponse({ status: 201, description: 'Transits returned' })
  async getWesternTransits(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { dateOfBirth: string; timeOfBirth: string; locale?: string },
  ) {
    return this.astrologyService.getWesternTransits(user.sub, dto);
  }

  @Get('chinese/flying-stars')
  @Public()
  @ApiOperation({ summary: 'Feng Shui Flying Stars 9-palace grid for a year' })
  @ApiResponse({ status: 200, description: 'Flying stars grid returned' })
  getFlyingStars(@Query('year') year?: string, @Query('locale') locale?: string) {
    const y = year ? parseInt(year, 10) : undefined;
    return this.astrologyService.getFlyingStars(y, locale);
  }

  @Post('hellenistic/zodiacal-releasing')
  @ApiOperation({ summary: 'Hellenistic Zodiacal Releasing (simplified)' })
  @ApiResponse({ status: 201, description: 'Releasing chapter returned' })
  async getZodiacalReleasing(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { dateOfBirth: string; locale?: string },
  ) {
    return this.astrologyService.getZodiacalReleasing(user.sub, dto);
  }

  @Post('medical/decumbiture')
  @ApiOperation({ summary: 'Medical astrology decumbiture chart' })
  @ApiResponse({ status: 201, description: 'Decumbiture analysis returned' })
  async getDecumbiture(
    @CurrentUser() user: JwtPayload,
    @Body() dto: {
      decumbitureDate?: string;
      decumbitureTime?: string;
      symptomsDescription?: string;
      locale?: string;
    },
  ) {
    return this.astrologyService.getDecumbiture(user.sub, dto);
  }
}
