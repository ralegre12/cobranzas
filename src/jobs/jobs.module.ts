import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JobsService } from './jobs.service';
import { MessageSendRuntime } from './runtimes/message-send.runtime';

import { RedisModule } from '../shared/redis.module';
import { MessagingModule } from '../messaging/messaging.module';
// ❌ eliminar: import { TemplatesModule } from '../templates/templates.module';
import { CasesModule } from '../cases/cases.module';
import { Message } from '../entities/message.entity';
import { Q_CAMPAIGN_DISPATCH, Q_CAMPAIGN_KICK, Q_MESSAGE_SEND, Q_NLP_INBOUND } from './queues';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    RedisModule,
    forwardRef(() => MessagingModule),
    forwardRef(() => CasesModule),
    TypeOrmModule.forFeature([Message]),
    BullModule.forRootAsync({
      imports: [RedisModule],
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASS || undefined,
          db: Number(process.env.REDIS_DB || 0),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: Q_MESSAGE_SEND },
      { name: Q_CAMPAIGN_KICK },
      { name: Q_CAMPAIGN_DISPATCH },
      { name: Q_NLP_INBOUND },
    ),
  ],
  providers: [JobsService, MessageSendRuntime],
  exports: [JobsService],
})
export class JobsModule {}
