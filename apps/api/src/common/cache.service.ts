import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

@Injectable()
export class MemoryCacheService {
  private cache = new Map<string, CacheEntry>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttlMs: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}
