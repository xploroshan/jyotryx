import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { AddMemoryDto } from './dto/add-memory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Memory')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's stored memories" })
  @ApiResponse({ status: 200, description: 'Memories returned' })
  list(@CurrentUser() user: JwtPayload) {
    return this.memoryService.list(user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Add a memory the astrologer should remember' })
  @ApiResponse({ status: 201, description: 'Memory created' })
  add(@CurrentUser() user: JwtPayload, @Body() dto: AddMemoryDto) {
    return this.memoryService.add(user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of the current user\'s memories' })
  @ApiResponse({ status: 200, description: 'Memory deleted' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.memoryService.remove(user.sub, id);
  }
}
