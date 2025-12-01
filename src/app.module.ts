// file: src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from './shared/snake.strategy';

import { RedisModule } from './shared/redis.module';
import { JobsModule } from './jobs/jobs.module';
import { AppConfigModule } from './shared/config.module';

// Traé módulos de features en lugar de declarar servicios/repos directo acá
import { TemplatesModule } from './templates/templates.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { DebtsModule } from './debts/debts.module';
import { MetricsModule } from './metrics/metrics.module';
import { MessagingModule } from './messaging/messaging.module';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { InboundModule } from './inbound/inbound.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'short', ttl: 10_000, limit: 20 },
    ]),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('DB_HOST', 'localhost'),
        port: parseInt(cfg.get('DB_PORT', '5432'), 10),
        username: cfg.get('DB_USER', 'postgres'),
        password: cfg.get('DB_PASS', 'postgres'),
        database: cfg.get('DB_NAME', 'cobranzas'),
        autoLoadEntities: true,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        entities: [__dirname + '/entities/**/*.entity.{ts,js}'], // 👈 asegura carga de *todas* las entidades
      }),
    }),

    RedisModule,
    JobsModule,
    AppConfigModule,
    TemplatesModule,
    WebhooksModule,
    DebtsModule,
    MetricsModule,
    MessagingModule,
    InboundModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }, // guard global
  ],
})
export class AppModule {}
