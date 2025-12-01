import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { Contact } from '../entities/contact.entity';
import { Debt } from '../entities/debt.entity';
import { Case } from '../entities/case.entity';
import { Message } from '../entities/message.entity';
import { Payment } from '../entities/payment.entity';
import { Reply } from '../entities/reply.entity';
import { Ptp } from '../entities/ptp.entity';

@Module({
  imports: [
    // Entities solo para resolver tableName/metadata y usar QueryBuilder si hace falta
    TypeOrmModule.forFeature([Contact, Debt, Case, Message, Payment, Reply, Ptp]),
    CacheModule.register({ ttl: 60 }), // 60s de cacheado en memoria
  ],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
