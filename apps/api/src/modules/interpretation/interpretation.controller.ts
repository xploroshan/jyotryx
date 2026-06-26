import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/current-user.decorator';
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
}
