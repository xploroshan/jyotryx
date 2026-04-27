import { Body, Controller, Get, Put, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

class UpdatePrefsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  briefingEmailEnabled!: boolean;
}

interface PrefsResponse {
  briefingEmailEnabled: boolean;
}

/**
 * Per-user preferences endpoint for the daily-briefing email opt-in.
 *
 * Lives here (not in /users/me) because it's part of a self-contained
 * notification feature; future "WhatsApp briefing" / "weekly digest"
 * fields will fan out from this same controller without bloating the
 * profile surface.
 */
@ApiTags('Briefing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('briefing/preferences')
export class BriefingPreferencesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get my daily-briefing email preference' })
  async get(@Request() req: any): Promise<PrefsResponse> {
    const u = await this.prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { briefingEmailEnabled: true },
    });
    return { briefingEmailEnabled: !!u?.briefingEmailEnabled };
  }

  @Put()
  @ApiOperation({ summary: 'Update my daily-briefing email preference' })
  async update(
    @Body() dto: UpdatePrefsDto,
    @Request() req: any,
  ): Promise<PrefsResponse> {
    const u = await this.prisma.user.update({
      where: { id: req.user.sub },
      data: { briefingEmailEnabled: !!dto.briefingEmailEnabled },
      select: { briefingEmailEnabled: true },
    });
    return { briefingEmailEnabled: u.briefingEmailEnabled };
  }
}
