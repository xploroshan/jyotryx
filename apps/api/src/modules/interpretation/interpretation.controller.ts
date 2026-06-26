import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public, CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { InterpretationService, InterpretationResult } from './interpretation.service';
import { InterpretDto } from './dto/interpret.dto';

@ApiTags('Interpretation')
@Controller('interpretation')
export class InterpretationController {
  constructor(private readonly interpretation: InterpretationService) {}

  // Public (works on pre-login public feature pages) but tightly throttled —
  // it calls the LLM, so cap fan-out like chat. Deterministic results are
  // cached, so repeat views don't even reach the model.
  @Post()
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Plain-language interpretation of a feature result' })
  @ApiResponse({ status: 201, description: 'Interpretation block' })
  async interpret(@Body() dto: InterpretDto): Promise<InterpretationResult> {
    return this.interpretation.interpret({
      domain: dto.domain,
      payload: dto.payload,
      locale: dto.locale,
      userId: null,
    });
  }

  // Paid long-form "deep dive". Requires auth; charges credits once per unique
  // (user, result) — free for active subscribers and under global free-mode,
  // and free forever to re-open the same result. Returns 402 when the user
  // can't pay so the web can prompt a top-up.
  @Post('deep-dive')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Paid long-form deep-dive interpretation' })
  @ApiResponse({ status: 201, description: 'Deep-dive interpretation block' })
  @ApiResponse({ status: 402, description: 'Insufficient credits — top up to unlock' })
  async deepDive(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InterpretDto,
  ): Promise<InterpretationResult> {
    return this.interpretation.generateDeepDive({
      userId: user.sub,
      domain: dto.domain,
      payload: dto.payload,
      locale: dto.locale,
    });
  }
}
