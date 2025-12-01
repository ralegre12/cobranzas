import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, JobsOptions, Processor, WorkerOptions } from 'bullmq';
import type { Redis as IORedisClient } from 'ioredis';
import { IOREDIS } from '../shared/tokens';
import { InjectQueue } from '@nestjs/bullmq';
import { Q_MESSAGE_SEND } from './queues';
import type { MessageSendJob } from './queues';

@Injectable()
export class JobsService implements OnModuleInit {
  private queues = new Map<string, Queue>();

  constructor(
    @Inject(IOREDIS) private readonly ioredis: IORedisClient,
    @InjectQueue(Q_MESSAGE_SEND) private readonly qSend: Queue,
  ) {}

  onModuleInit() {
    this.createQueue('campaign-kick');
    this.createQueue('campaign-dispatch');
    this.createQueue('message-send');
    this.createQueue('nlp-inbound');
  }

  private createQueue(name: string) {
    const connection = this.ioredis.duplicate();
    const q = new Queue(name, { connection });
    this.queues.set(name, q);
    return q;
  }

  getQueue(name: string) {
    return this.queues.get(name) ?? this.createQueue(name);
  }

  addJob(name: string, data: any, opts?: JobsOptions) {
    return this.getQueue(name)!.add(name, data, opts);
  }

  createWorker<T = any>(
    name: string,
    processor: Processor<T, any, string>,
    opts?: Omit<WorkerOptions, 'connection'>,
  ) {
    const options: WorkerOptions = { ...opts, connection: this.ioredis.duplicate() };
    return new Worker<T, any, string>(name, processor, options);
  }

  addBulk(name: string, jobs: { name?: string; data: any; opts?: JobsOptions }[]) {
    const q = this.getQueue(name)!;
    return q.addBulk(jobs.map((j) => ({ name: j.name ?? name, data: j.data, opts: j.opts })));
  }

  /** Job de envío (acepta payload por messageId o payload completo) */
  addMessageSend(payload: MessageSendJob) {
    return this.qSend.add('send', payload as any, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1500 },
    });
  }
}
