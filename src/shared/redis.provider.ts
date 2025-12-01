import { Provider } from '@nestjs/common';
import { IOREDIS } from './tokens';
import IORedis from 'ioredis';

export function provideIORedis(): Provider {
  return {
    provide: IOREDIS,
    useFactory: () => {
      const client = new IORedis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB || 0),
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
      });
      return client;
    },
  };
}
