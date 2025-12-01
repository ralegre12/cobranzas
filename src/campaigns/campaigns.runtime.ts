// file: src/campaigns/campaigns.runtime.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JobsService } from '../jobs/jobs.service';
import { Job, Processor } from 'bullmq';
import {
  Q_CAMPAIGN_KICK,
  Q_CAMPAIGN_DISPATCH,
  Q_MESSAGE_SEND,
  CampaignDispatchJob,
  Channel,
  CampaignKickJob,
} from '../jobs/queues';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignsRuntime implements OnModuleInit {
  private readonly logger = new Logger(CampaignsRuntime.name);

  constructor(
    private readonly jobs: JobsService,
    // 👇 lo usamos para kick repeatable
    private readonly campaigns: CampaignsService,
    private readonly ds: DataSource,
  ) {}

  async onModuleInit() {
    // Worker que dispara dispatch en base a CRON (repeatable)
    const kick: Processor<CampaignKickJob> = async (job: Job<CampaignKickJob>) => {
      const { campaignId } = job.data;
      // Debemos conocer el tenant; lo tomamos de la propia campaña
      const c = (
        await this.ds.query(`SELECT tenant_id FROM campaigns WHERE id = $1`, [campaignId])
      )?.[0];
      if (!c?.tenant_id) return;
      await this.campaigns.dispatchCampaign(String(c.tenant_id), campaignId);
    };
    this.jobs.createWorker<CampaignKickJob>(Q_CAMPAIGN_KICK, kick, { concurrency: 2 });

    // Worker que convierte "campaign-dispatch" en "message-send"
    const processor: Processor<CampaignDispatchJob> = async (job: Job<CampaignDispatchJob>) => {
      const { caseId, channels, templateCode } = job.data;

      // SQL compatible con ambos esquemas (snake/camel)
      const kase = (
        await this.ds.query(
          `SELECT 
            c.id,
            COALESCE(ct.full_name, ct."fullName")      AS debtor_name,
            COALESCE(ct.phone, '')                     AS debtor_phone,
            COALESCE(ct.email, '')                     AS debtor_email,
            COALESCE(d.reference, '')                  AS reference,
            COALESCE(d.amount, d.amount_cents/100.0)   AS amount,
            COALESCE(d.due_date, d."dueDate")          AS due_date,
            COALESCE(c.tenant_id, c."tenantId")        AS tenant_id
         FROM cases c
         LEFT JOIN contacts ct ON ct.id = COALESCE(c.contact_id, c."contactId")
         LEFT JOIN debts d     ON d.id = c.debt_id OR d.case_id = c.id OR d."caseId" = c.id
         WHERE c.id = $1
         LIMIT 1`,
          [caseId],
        )
      )?.[0];

      if (!kase) {
        this.logger.warn(`case ${caseId} no encontrado`);
        return;
      }

      const isAvail = (ch: Channel) =>
        (ch === 'EMAIL' && !!kase.debtor_email) ||
        ((ch === 'WHATSAPP' || ch === 'SMS') && !!kase.debtor_phone);

      const chosen = (channels as Channel[]).find((c) => isAvail(c));
      if (!chosen) {
        this.logger.warn(`case ${caseId}: sin canal disponible`);
        return;
      }

      const vars = {
        name: String(kase.debtor_name || ''),
        amount: String(kase.amount || ''),
        dueDate: kase.due_date ? new Date(kase.due_date).toISOString().slice(0, 10) : '',
        reference: String(kase.reference || ''),
      };

      await this.jobs.addJob(
        Q_MESSAGE_SEND,
        {
          tenantId: kase.tenant_id,
          caseId: kase.id,
          channel: chosen,
          templateCode,
          variables: vars,
          to: chosen === 'EMAIL' ? kase.debtor_email : kase.debtor_phone,
        },
        { removeOnComplete: true, attempts: 5, backoff: { type: 'exponential', delay: 60_000 } },
      );
    };

    this.jobs.createWorker<CampaignDispatchJob>(Q_CAMPAIGN_DISPATCH, processor, { concurrency: 2 });
  }
}
