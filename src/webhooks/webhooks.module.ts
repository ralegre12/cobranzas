import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebhooksPaymentsController } from './webhooks.payments.controller';
import { WebhooksWhatsappController } from './webhooks.whatsapp.controller';
import { WebhooksVapiController } from './webhooks.vapi.controller';

import { RedisModule } from '../shared/redis.module';
import { IdempotencyService } from '../shared/idempotency.service';

import { PaymentsModule } from '../payments/payments.module';
import { JobsModule } from '../jobs/jobs.module';

import { Payment } from '../entities/payment.entity';
import { Case } from '../entities/case.entity';

@Module({
  imports: [RedisModule, JobsModule, PaymentsModule, TypeOrmModule.forFeature([Payment, Case])],
  controllers: [WebhooksPaymentsController, WebhooksWhatsappController, WebhooksVapiController],
  providers: [IdempotencyService],
})
export class WebhooksModule {}
