import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
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
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp|heic)$/)) {
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
  @ApiOperation({ summary: 'Analyze a palm image for palmistry reading' })
  @ApiResponse({ status: 201, description: 'Palm analysis completed' })
  @ApiResponse({ status: 400, description: 'Invalid image or insufficient credits' })
  async analyzePalm(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<PalmistryAnalysis> {
    return this.palmistryService.analyzePalm(
      user.sub,
      file?.buffer,
      file?.mimetype,
    );
  }
}
