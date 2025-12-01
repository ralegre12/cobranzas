// file: src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { Inject } from '@nestjs/common';
import { IOREDIS } from '../shared/tokens';

@Controller('health')
export class HealthController {
  constructor(
    private readonly ds: DataSource,
    @Inject(IOREDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async health() {
    const db = await this.ds
      .query('SELECT 1 as ok')
      .then(() => 'up')
      .catch(() => 'down');
    const redis = await this.redis
      .ping()
      .then((r) => (r === 'PONG' ? 'up' : 'down'))
      .catch(() => 'down');
    return { ok: db === 'up' && redis === 'up', db, redis, ts: new Date().toISOString() };
  }
}
