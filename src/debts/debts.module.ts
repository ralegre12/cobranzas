import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { Contact } from '../entities/contact.entity';
import { Debt } from '../entities/debt.entity';
import { Case } from '../entities/case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contact, Debt, Case])],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
