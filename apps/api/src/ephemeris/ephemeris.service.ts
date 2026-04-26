import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryCacheService } from '../common/cache.service';
import { WorkerPool } from './worker-pool';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ChartInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  lat: number;
  lng: number;
  tzOffset?: number;
}

export interface PlanetPosition {
  name: string;
  longitude: number;
  speed: number;
}

export interface ChartResult {
  julianDay: number;
  positions: PlanetPosition[];
  ascendant: number;
  houses: number[];
}

@Injectable()
export class EphemerisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EphemerisService.name);
  private pool: WorkerPool | null = null;
  private readonly useWorkers: boolean;

  // Fallback: synchronous swisseph for when workers are disabled
  private swisseph: any = null;

  constructor(
    private configService: ConfigService,
    private cacheService: MemoryCacheService,
  ) {
    const workerCount = parseInt(this.configService.get<string>('EPHEMERIS_WORKER_COUNT', '4'), 10);
    this.useWorkers = workerCount > 0;

    // Always load the synchronous swisseph in the main thread, even
    // when worker mode is on. The pool's `initialize()` doesn't await
    // the workers' actual readiness — they can `Module did not
    // self-register` *after* init resolves successfully (musl/alpine
    // worker_threads issue), leaving us with a "happy" pool that
    // silently times out every task. Having the sync client preloaded
    // means `computeChart` can fall back instantly instead of failing
    // the user-visible request after a 10-second worker timeout.
    try {
      this.swisseph = require('swisseph');
      const EPHE_PATH = path.join(path.dirname(require.resolve('swisseph')), 'ephe');
      this.swisseph.swe_set_ephe_path(EPHE_PATH);
      this.swisseph.swe_set_sid_mode(this.swisseph.SE_SIDM_LAHIRI, 0, 0);
    } catch {
      this.swisseph = null;
    }
  }

  async onModuleInit() {
    if (this.useWorkers) {
      const workerCount = parseInt(this.configService.get<string>('EPHEMERIS_WORKER_COUNT', '4'), 10);
      const workerPath = path.join(__dirname, 'ephemeris.worker.js');
      this.pool = new WorkerPool(workerPath, workerCount);
      try {
        await this.pool.initialize();
        this.logger.log(`Ephemeris worker pool started (${workerCount} workers)`);
      } catch (err) {
        this.logger.error('Failed to start ephemeris worker pool, falling back to sync', err);
        this.pool = null;
        // Load synchronous fallback
        try {
          this.swisseph = require('swisseph');
          const EPHE_PATH = path.join(path.dirname(require.resolve('swisseph')), 'ephe');
          this.swisseph.swe_set_ephe_path(EPHE_PATH);
          this.swisseph.swe_set_sid_mode(this.swisseph.SE_SIDM_LAHIRI, 0, 0);
        } catch {
          this.swisseph = null;
        }
      }
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.destroy();
    }
  }

  /**
   * Compute a full natal chart, with Redis caching.
   * Birth charts (same input) never change, so we cache for 24h.
   */
  async computeChart(input: ChartInput): Promise<ChartResult> {
    const cacheKey = `chart:${this.hashInput(input)}`;

    const cached = await this.cacheService.get<ChartResult>(cacheKey);
    if (cached) return cached;

    const result = await this.computeWithFallback(input);

    // Cache birth charts for 24h
    await this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000);
    return result;
  }

  /**
   * Compute a chart for the current time (panchang, transits).
   * Shorter cache TTL since these change.
   */
  async computeCurrentChart(lat: number, lng: number): Promise<ChartResult> {
    const now = new Date();
    // Round to nearest 5 minutes for cache alignment
    const minute = Math.floor(now.getMinutes() / 5) * 5;
    const input: ChartInput = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getUTCHours(),
      minute,
      lat,
      lng,
      tzOffset: 0, // Already UTC
    };

    const cacheKey = `chart:current:${this.hashInput(input)}`;
    const cached = await this.cacheService.get<ChartResult>(cacheKey);
    if (cached) return cached;

    const result = await this.computeWithFallback(input);

    // Cache current charts for 5 minutes
    await this.cacheService.set(cacheKey, result, 5 * 60 * 1000);
    return result;
  }

  /**
   * Try the worker pool, fall back to the sync swisseph in the main
   * thread on any pool failure (most often: workers `Module did not
   * self-register` and time out at 10s). Once the pool fails for the
   * first time, we mark it dead and skip the worker call entirely on
   * subsequent requests so users don't eat a 10-second wait per
   * request waiting for a pool we already know is broken.
   */
  private poolDeadAfterFirstFailure = false;

  private async computeWithFallback(input: ChartInput): Promise<ChartResult> {
    if (this.pool && !this.poolDeadAfterFirstFailure) {
      try {
        return await this.pool.execute<ChartResult>('computeFullChart', input);
      } catch (err: any) {
        this.logger.error(
          `Worker pool failed (${err?.message ?? err}); falling back to sync swisseph and disabling pool for this process.`,
        );
        this.poolDeadAfterFirstFailure = true;
        // Fall through to sync.
      }
    }
    if (!this.swisseph) {
      throw new Error(
        'Ephemeris unavailable: workers failed and the synchronous swisseph binding could not be loaded either.',
      );
    }
    return this.computeChartSync(input);
  }

  // ─── Synchronous fallback ───────────────────────────────────────────────

  private computeChartSync(input: ChartInput): ChartResult {
    if (!this.swisseph) throw new Error('Swiss Ephemeris not available');

    const tz = input.tzOffset != null ? input.tzOffset : (input.lng / 15);
    const utHour = input.hour + input.minute / 60 - tz;
    const jd = this.swisseph.swe_julday(input.year, input.month, input.day, utHour, this.swisseph.SE_GREG_CAL);

    const PLANETS = [
      { id: this.swisseph.SE_SUN, name: 'Sun' },
      { id: this.swisseph.SE_MOON, name: 'Moon' },
      { id: this.swisseph.SE_MARS, name: 'Mars' },
      { id: this.swisseph.SE_MERCURY, name: 'Mercury' },
      { id: this.swisseph.SE_JUPITER, name: 'Jupiter' },
      { id: this.swisseph.SE_VENUS, name: 'Venus' },
      { id: this.swisseph.SE_SATURN, name: 'Saturn' },
      { id: this.swisseph.SE_TRUE_NODE, name: 'Rahu' },
    ];

    const flags = this.swisseph.SEFLG_SIDEREAL | this.swisseph.SEFLG_SPEED;
    const positions: PlanetPosition[] = PLANETS.map((p) => {
      const result = this.swisseph.swe_calc_ut(jd, p.id, flags);
      const lng = ((result.longitude % 360) + 360) % 360;
      return { name: p.name, longitude: lng, speed: result.longitudeSpeed || 0 };
    });

    const rahu = positions.find((p) => p.name === 'Rahu')!;
    positions.push({ name: 'Ketu', longitude: (rahu.longitude + 180) % 360, speed: rahu.speed });

    const housesResult = this.swisseph.swe_houses(jd, input.lat, input.lng, 'E');
    const ascendant = ((housesResult.ascendant % 360) + 360) % 360;
    const houses: number[] = [];
    for (let i = 1; i <= 12; i++) {
      houses.push(((housesResult.house[i] % 360) + 360) % 360);
    }

    return { julianDay: jd, positions, ascendant, houses };
  }

  private hashInput(input: ChartInput): string {
    const key = `${input.year}:${input.month}:${input.day}:${input.hour}:${input.minute}:${input.lat.toFixed(4)}:${input.lng.toFixed(4)}:${input.tzOffset ?? ''}`;
    return crypto.createHash('md5').update(key).digest('hex').slice(0, 16);
  }
}
