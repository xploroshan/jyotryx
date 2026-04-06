import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NumerologyService, NameAnalysisResult, BrandAnalysisResult, PersonalYearResult } from './numerology.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload, Public } from '../../common/decorators/current-user.decorator';
import { AnalyzeNameDto, AnalyzeBrandDto } from './dto/analyze-name.dto';

@ApiTags('Numerology')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('numerology')
export class NumerologyController {
  constructor(private readonly numerologyService: NumerologyService) {}

  @Post('name')
  @Public()
  @ApiOperation({ summary: 'Analyze a personal name numerologically' })
  async analyzeName(@Body() dto: AnalyzeNameDto): Promise<NameAnalysisResult> {
    return this.numerologyService.analyzeName(dto.name);
  }

  @Post('brand')
  @Public()
  @ApiOperation({ summary: 'Analyze a brand/business name numerologically' })
  async analyzeBrand(@Body() dto: AnalyzeBrandDto): Promise<BrandAnalysisResult> {
    return this.numerologyService.analyzeBrand(dto.brandName, dto.industry);
  }

  @Get('personal-year')
  @ApiOperation({ summary: 'Get personal year forecast based on DOB' })
  async getPersonalYear(@Query('dateOfBirth') dateOfBirth: string): Promise<PersonalYearResult> {
    return this.numerologyService.getPersonalYear(dateOfBirth);
  }
}
