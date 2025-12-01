// file: src/shared/idempotency.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS } from './tokens';

@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS) private readonly redis: RedisClientType) {}

  /** true si se pudo reservar (no existía). TTL por defecto 24h */
  async reserveOnce(key: string, ttlSec = 24 * 3600): Promise<boolean> {
    const res = await this.redis.set(key, '1', { NX: true, EX: ttlSec });
    return res === 'OK';
  }
}
