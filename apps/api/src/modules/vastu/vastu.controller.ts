import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VastuService } from './vastu.service';
import { VastuAnalysisDto } from './dto/vastu-analysis.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Vastu')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('vastu')
export class VastuController {
  constructor(private readonly vastuService: VastuService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Get Vastu Shastra analysis for a property' })
  @ApiResponse({ status: 201, description: 'Vastu analysis generated' })
  async analyze(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VastuAnalysisDto,
  ) {
    return this.vastuService.analyze(user.sub, dto);
  }
}
