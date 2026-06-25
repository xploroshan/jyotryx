import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatService, ChatSession, ChatMessage } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Tighter than the global 60/min cap: chat drives the most expensive
  // (LLM-token-billed) work, so bound the rate on the two model-calling
  // endpoints specifically to limit fan-out abuse.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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

  @Post('stream')
  @Sse()
  @ApiOperation({ summary: 'Send a message and stream the AI response via SSE' })
  @ApiResponse({ status: 200, description: 'SSE stream of token events' })
  @ApiResponse({ status: 400, description: 'Insufficient credits or invalid input' })
  streamMessage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ): Observable<MessageEvent> {
    return this.chatService.sendMessageStream(user.sub, dto);
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
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<ChatSession> {
    return this.chatService.getSession(user.sub, sessionId);
  }
}
