// file: src/inbound/inbound.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { InboundService } from './inbound.service';
import { InboundRuntime } from './inbound.runtime';
import { InboundController } from './inbound.controller';
import { CasesModule } from '../cases/cases.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [forwardRef(() => CasesModule), forwardRef(() => JobsModule)],
  controllers: [InboundController], // 👈 FALTABA ESTO
  providers: [InboundService, InboundRuntime],
  exports: [InboundService],
})
export class InboundModule {}
