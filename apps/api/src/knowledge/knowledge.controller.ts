import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../modules/admin/admin.guard';
import { isKbCategory, KB_CATEGORIES } from './kb-categories';
import { KbService } from './kb.service';

@ApiTags('Knowledge Base')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly kbService: KbService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get knowledge base statistics (admin only)' })
  async getStats() {
    // Iterate the CANONICAL category registry, not a hand-written list. The
    // previous hardcoded array had drifted badly: it asked for 'kundli',
    // 'horoscope' and 'general' (which are not categories at all, so they
    // always reported nothing) while omitting eleven real ones — career,
    // health, transits, muhurat, divisional_charts, ashtakvarga, shadbala,
    // tarot, vastu, horoscopes and remedy — so the admin KB page under-
    // reported the corpus and, critically, could never reveal that tarot and
    // vastu held zero rows.
    const stats: Record<string, number> = {};
    const empty: string[] = [];
    let total = 0;
    for (const cat of KB_CATEGORIES) {
      const count = await this.knowledgeService.getDocumentCount(cat);
      stats[cat] = count;
      total += count;
      // Surfaced explicitly: an empty category means every lookup against it
      // returns no grounding and the caller silently falls back.
      if (count === 0) empty.push(cat);
    }

    return { total, categories: stats, emptyCategories: empty };
  }

  @Get('coverage')
  @ApiOperation({
    summary: 'KB locale coverage since process start (admin only)',
  })
  getCoverage() {
    // Answers "how much of the structured KB actually exists in Tamil?" —
    // previously unanswerable, because a locale miss silently rendered
    // English and left no trace.
    return this.kbService.getCoverageReport();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge base (admin only)' })
  async search(
    @Query('q') query: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    // `category` arrives from an HTTP query string, so it is untrusted:
    // narrow it at the boundary. An unknown value searches ALL categories
    // rather than exact-matching a name that cannot exist (which would
    // always return zero results).
    const results = await this.knowledgeService.search(
      query,
      isKbCategory(category) ? category : undefined,
      limit ? parseInt(limit, 10) : 5,
    );
    return { results, count: results.length };
  }
}
