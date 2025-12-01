// file: src/shared/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import Redis, { type Redis as IORedisClient } from 'ioredis';
import { REDIS, IOREDIS } from './tokens';

@Global()
@Module({
  providers: [
    // node-redis (para idempotencia/rate-limit/webhooks)
    {
      provide: REDIS,
      useFactory: async (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const client: RedisClientType = createClient({ url });
        client.on('error', (e) => console.error('[node-redis] error', e));
        await client.connect();
        return client;
      },
      inject: [ConfigService],
    },
    // ioredis (para BullMQ)
    {
      provide: IOREDIS,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const client: IORedisClient = new Redis(url, {
          maxRetriesPerRequest: null, // recomendado por BullMQ
          enableReadyCheck: false,
        });
        client.on('error', (e) => console.error('[ioredis] error', e));
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS, IOREDIS],
})
export class RedisModule {}
export { REDIS };
