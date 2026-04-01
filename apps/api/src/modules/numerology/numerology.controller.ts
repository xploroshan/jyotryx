import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NumerologyService, NameAnalysisResult, BrandAnalysisResult, PersonalYearResult } from './numerology.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';

@ApiTags('Numerology')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('numerology')
export class NumerologyController {
  constructor(private readonly numerologyService: NumerologyService) {}

  @Post('name')
  @Public()
  @ApiOperation({ summary: 'Analyze a personal name numerologically' })
  async analyzeName(@Body() body: { name: string }): Promise<NameAnalysisResult> {
    return this.numerologyService.analyzeName(body.name);
  }

  @Post('brand')
  @Public()
  @ApiOperation({ summary: 'Analyze a brand/business name numerologically' })
  async analyzeBrand(@Body() body: { brandName: string; industry?: string }): Promise<BrandAnalysisResult> {
    return this.numerologyService.analyzeBrand(body.brandName, body.industry);
  }

  @Get('personal-year')
  @ApiOperation({ summary: 'Get personal year forecast based on DOB' })
  async getPersonalYear(@Query('dateOfBirth') dateOfBirth: string): Promise<PersonalYearResult> {
    return this.numerologyService.getPersonalYear(dateOfBirth);
  }
}
