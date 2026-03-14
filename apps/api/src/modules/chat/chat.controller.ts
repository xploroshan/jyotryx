import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService, ChatSession, ChatMessage, SendMessageDto } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @ApiOperation({ summary: 'Send a message to the AI astrologer' })
  @ApiResponse({ status: 201, description: 'Message sent and AI reply received' })
  @ApiResponse({ status: 400, description: 'Insufficient credits or invalid input' })
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ): Promise<{ session: ChatSession; reply: ChatMessage }> {
    return this.chatService.sendMessage(user.sub, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get all chat sessions for current user' })
  @ApiResponse({ status: 200, description: 'List of chat sessions' })
  async getSessions(
    @CurrentUser() user: JwtPayload,
  ): Promise<Omit<ChatSession, 'messages'>[]> {
    return this.chatService.getSessions(user.sub);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a specific chat session with messages' })
  @ApiResponse({ status: 200, description: 'Chat session with full message history' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(
    @CurrentUser() user: JwtPayload,
    @Param('id') sessionId: string,
  ): Promise<ChatSession> {
    return this.chatService.getSession(user.sub, sessionId);
  }
}
