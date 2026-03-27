import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../modules/admin/admin.guard';

@ApiTags('Knowledge Base')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get knowledge base statistics (admin only)' })
  async getStats() {
    const categories = [
      'kundli', 'horoscope', 'dosha', 'remedy', 'matching',
      'panchang', 'numerology', 'palmistry', 'general',
      'planets', 'houses', 'signs', 'nakshatras', 'yogas',
    ];

    const stats: Record<string, number> = {};
    let total = 0;
    for (const cat of categories) {
      const count = await this.knowledgeService.getDocumentCount(cat);
      if (count > 0) {
        stats[cat] = count;
        total += count;
      }
    }

    return { total, categories: stats };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge base (admin only)' })
  async search(
    @Query('q') query: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    const results = await this.knowledgeService.search(
      query,
      category,
      limit ? parseInt(limit, 10) : 5,
    );
    return { results, count: results.length };
  }
}
