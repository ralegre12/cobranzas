import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { NlpInboundJob, Q_NLP_INBOUND } from '../jobs/queues';
import { Job, Processor } from 'bullmq';
import { InboundService } from './inbound.service';

@Injectable()
export class InboundRuntime implements OnModuleInit {
  private readonly logger = new Logger(InboundRuntime.name);
  constructor(
    private readonly jobs: JobsService,
    private readonly inbound: InboundService,
  ) {}

  async onModuleInit() {
    const processor: Processor<NlpInboundJob> = async (job: Job<NlpInboundJob>) => {
      try {
        return await this.inbound.handle(job.data);
      } catch (e: any) {
        this.logger.error(`Inbound error: ${e?.message || e}`);
        throw e;
      }
    };

    this.jobs.createWorker<NlpInboundJob>(Q_NLP_INBOUND, processor, { concurrency: 8 });
  }
}
