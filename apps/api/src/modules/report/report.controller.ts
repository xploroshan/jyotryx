import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService, ReportResponse, GenerateReportDto } from './report.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Generate an astrology report (returns 202 when queued)' })
  @ApiResponse({ status: 202, description: 'Report generation started' })
  @ApiResponse({ status: 400, description: 'Insufficient credits' })
  async generateReport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateReportDto,
  ): Promise<ReportResponse> {
    return this.reportService.generateReport(user.sub, dto);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get report generation status' })
  @ApiResponse({ status: 200, description: 'Report status returned' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReportStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) reportId: string,
  ): Promise<{ id: string; status: string; completedAt?: string }> {
    return this.reportService.getReportStatus(user.sub, reportId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific report by ID' })
  @ApiResponse({ status: 200, description: 'Report returned' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async getReport(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) reportId: string,
  ): Promise<ReportResponse> {
    return this.reportService.getReport(user.sub, reportId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports for current user' })
  @ApiResponse({ status: 200, description: 'List of reports' })
  async getUserReports(
    @CurrentUser() user: JwtPayload,
  ): Promise<Omit<ReportResponse, 'sections'>[]> {
    return this.reportService.getUserReports(user.sub);
  }
}
