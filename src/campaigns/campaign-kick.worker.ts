import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { Q_CAMPAIGN_KICK, Q_CAMPAIGN_DISPATCH } from '../jobs/queues';
import { DataSource } from 'typeorm';

@Injectable()
export class CampaignKickWorker implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly ds: DataSource,
  ) {}
  onModuleInit() {
    this.jobs.createWorker(Q_CAMPAIGN_KICK, async (job) => {
      const { campaignId } = job.data || {};
      if (!campaignId) return;
      const camp = (
        await this.ds.query(`SELECT * FROM campaigns WHERE id = $1 LIMIT 1`, [campaignId])
      )?.[0];
      if (!camp || camp.status === 'PAUSED') return;

      await this.jobs.addJob(Q_CAMPAIGN_DISPATCH, { campaignId, channels: camp.channel_priority });
    });
  }
}
