import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PalmistryService, PalmistryAnalysis } from './palmistry.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Palmistry')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('palmistry')
export class PalmistryController {
  constructor(private readonly palmistryService: PalmistryService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp|heic|heif)$/i)) {
          return callback(new BadRequestException('Only image files (JPEG, PNG, WebP, HEIC) are allowed'), false);
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Palm image file (JPEG, PNG, WebP, or HEIC)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Analyze a palm image (returns 202 when queued)' })
  @ApiResponse({ status: 202, description: 'Palm analysis started' })
  @ApiResponse({ status: 400, description: 'Invalid image or insufficient credits' })
  async analyzePalm(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: any,
    @Body() body?: { locale?: string; gender?: string },
  ): Promise<PalmistryAnalysis> {
    const gender = body?.gender === 'male' || body?.gender === 'female' ? body.gender : undefined;
    return this.palmistryService.analyzePalm(
      user.sub,
      file?.buffer,
      file?.mimetype,
      body?.locale,
      gender,
    );
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get palmistry reading status (and full analysis once complete)' })
  @ApiResponse({ status: 200, description: 'Reading status returned' })
  async getReadingStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) readingId: string,
  ): Promise<{ id: string; status: string; analysis?: PalmistryAnalysis }> {
    return this.palmistryService.getReadingStatus(user.sub, readingId);
  }

  @Get(':id/image')
  @ApiOperation({ summary: 'Get a presigned download URL for a palmistry reading image' })
  @ApiResponse({ status: 200, description: 'Presigned URL returned' })
  @ApiResponse({ status: 404, description: 'Reading not found or no image' })
  async getImageUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) readingId: string,
  ): Promise<{ url: string }> {
    return this.palmistryService.getImageUrl(user.sub, readingId);
  }
}
