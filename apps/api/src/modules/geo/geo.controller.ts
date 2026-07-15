import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GeoService, GeoSuggestion } from './geo.service';

@ApiTags('Geo')
@ApiBearerAuth('JWT-auth')
// Authenticated-only: this is a birthplace picker for logged-in users editing
// their profile / casting a chart. Requiring auth keeps it from becoming an
// open geocoding proxy.
@UseGuards(JwtAuthGuard)
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('search')
  @ApiOperation({ summary: 'Type-ahead geocoding for a birthplace (OSM/Photon, proxied + cached)' })
  @ApiQuery({ name: 'q', required: true, description: 'Partial place name (min 2 chars)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max suggestions (1–8, default 6)' })
  @ApiQuery({ name: 'lang', required: false, description: 'Result language (2-letter, default en)' })
  async search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('lang') lang?: string,
  ): Promise<GeoSuggestion[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 6;
    return this.geoService.search(q ?? '', Number.isFinite(parsedLimit) ? parsedLimit : 6, lang || 'en');
  }
}
