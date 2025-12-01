import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment as PaymentEntity } from '../entities/payment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { JobsModule } from '../jobs/jobs.module';
import { CasesModule } from '../cases/cases.module';
import { RedisModule } from '../shared/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity]), JobsModule, CasesModule, RedisModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
