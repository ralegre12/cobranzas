// file: src/shared/rate-limiter.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type { RedisClientType } from 'redis';
import { REDIS } from './tokens';

@Injectable()
export class RateLimiterService {
  constructor(@Inject(REDIS) private readonly redis: RedisClientType) {}

  /** keyScope ej: "tenant:123". Devuelve si se permite (token bucket/minuto simple). */
  async allowPerMinute(keyScope: string, limit = 60, cost = 1): Promise<boolean> {
    const bucket = `rl:${keyScope}:${Math.floor(Date.now() / 60000)}`;
    const used = await this.redis.incrBy(bucket, cost);
    if (used === 1) await this.redis.expire(bucket, 60);
    return used <= limit;
  }
}
