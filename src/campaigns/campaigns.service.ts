// file: src/campaigns/campaigns.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JobsService } from '../jobs/jobs.service';
import { Q_CAMPAIGN_DISPATCH, Q_CAMPAIGN_KICK, Channel } from '../jobs/queues';
import dayjs from 'dayjs';

type DispatchOverrides = {
  templateCode?: string;
  channels?: Channel[];
  dailyCap?: number;
};

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  constructor(
    private readonly jobs: JobsService,
    private readonly ds: DataSource,
  ) {}

  // CRUD (rápido con SQL crudo; podés pasarlo a repos)
  list(tenantId: string) {
    return this.ds.query(`SELECT * FROM campaigns WHERE tenant_id = $1 ORDER BY updated_at DESC`, [
      tenantId,
    ]);
  }
  get(tenantId: string, id: string) {
    return this.ds
      .query(`SELECT * FROM campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId])
      .then((r) => r[0]);
  }
  async create(tenantId: string, dto: any) {
    const row = (
      await this.ds.query(
        `INSERT INTO campaigns (tenant_id,name,segment_id,channel_priority,daily_cap,status,schedule_cron,template_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          tenantId,
          dto.name,
          dto.segmentId,
          JSON.stringify(dto.channelPriority ?? ['WHATSAPP', 'SMS', 'EMAIL']),
          dto.dailyCap ?? 500,
          dto.status ?? 'ACTIVE',
          dto.scheduleCron ?? null,
          dto.templateCode ?? null,
        ],
      )
    )[0];
    return row;
  }
  async update(tenantId: string, id: string, dto: any) {
    const current = await this.get(tenantId, id);
    if (!current) throw new BadRequestException('Campaign not found');
    const merged = {
      ...current,
      ...dto,
      channel_priority: JSON.stringify(
        dto.channelPriority ?? current.channel_priority ?? ['WHATSAPP', 'SMS', 'EMAIL'],
      ),
    };
    const row = (
      await this.ds.query(
        `UPDATE campaigns
         SET name=$3, segment_id=$4, channel_priority=$5::jsonb, daily_cap=$6, status=$7, schedule_cron=$8, template_code=$9, updated_at=now()
       WHERE id=$1 AND tenant_id=$2
       RETURNING *`,
        [
          id,
          tenantId,
          merged.name,
          merged.segment_id ?? merged.segmentId,
          merged.channel_priority,
          merged.daily_cap ?? merged.dailyCap,
          merged.status,
          merged.schedule_cron ?? merged.scheduleCron,
          merged.template_code ?? merged.templateCode,
        ],
      )
    )[0];
    return row;
  }

  async setStatus(tenantId: string, id: string, status: 'ACTIVE' | 'PAUSED') {
    const row = (
      await this.ds.query(
        `UPDATE campaigns SET status=$3, updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *`,
        [id, tenantId, status],
      )
    )[0];
    return row ?? { ok: false, reason: 'not_found' };
  }

  // Programación con BullMQ repeatable
  async ensureRepeatable(tenantId: string, campaignId: string) {
    const c = await this.get(tenantId, campaignId);
    if (!c) throw new BadRequestException('Campaign not found');
    if (!c.schedule_cron) throw new BadRequestException('scheduleCron vacío');

    const q = this.jobs.getQueue(Q_CAMPAIGN_KICK);
    // Limpio cualquier repeat previo
    const rep = await q.getRepeatableJobs();
    await Promise.all(
      rep
        .filter((r) => r.id === `camp:${campaignId}:repeat`)
        .map((r) => q.removeRepeatableByKey(r.key)),
    );

    await q.add(
      'kick',
      { campaignId },
      {
        jobId: `camp:${campaignId}:repeat`,
        repeat: { pattern: c.schedule_cron }, // CRON
        removeOnComplete: true,
      },
    );
    return { ok: true, scheduled: c.schedule_cron };
  }

  // Ejecución manual/cron
  async dispatchCampaign(tenantId: string, campaignId: string, o: DispatchOverrides = {}) {
    // 1) campaña
    const camp = await this.get(tenantId, campaignId);
    if (!camp) throw new BadRequestException('Campaign not found');
    if (camp.status === 'PAUSED') return { queued: 0, reason: 'paused' };

    // 2) segmento
    const seg = (
      await this.ds.query(
        `SELECT id, filter_sql FROM segments WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)`,
        [camp.segment_id, tenantId],
      )
    )?.[0];
    if (!seg) throw new BadRequestException('Segment not found');

    const filterSql: string = seg.filter_sql?.toString() ?? '';
    this.assertSafeSelect(filterSql);

    // 3) ejecutar selección con guard de tenant (siempre)
    const guarded = this.wrapWithTenantGuard(filterSql);
    const rows: { id: string }[] = await this.ds.query(`SELECT * FROM (${guarded}) z`, [tenantId]);

    // 4) cap diario
    const dailyCap: number = Number(o.dailyCap ?? camp.daily_cap ?? 500);
    const slice = rows.slice(0, Math.max(0, dailyCap));

    // 5) canales
    let channels: Channel[] = ['WHATSAPP', 'SMS', 'EMAIL'];
    try {
      const cp = Array.isArray(camp.channel_priority)
        ? camp.channel_priority
        : JSON.parse(camp.channel_priority ?? '[]');
      channels = (o.channels?.length ? o.channels : cp?.length ? cp : channels) as Channel[];
    } catch {
      if (o.channels?.length) channels = o.channels;
    }

    // 6) template
    const templateCode: string = o.templateCode ?? camp.template_code ?? 'WA_FIRST_REMINDER';

    // 7) encolar con idempotencia por día (jobId único)
    const today = dayjs().format('YYYYMMDD');
    let queued = 0;
    for (const item of slice) {
      const jobId = `camp:${campaignId}:case:${item.id}:d${today}`;
      await this.jobs.addJob(
        Q_CAMPAIGN_DISPATCH,
        { campaignId, caseId: item.id, channels, templateCode },
        {
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          jobId,
        },
      );
      queued++;
    }

    this.logger.log(`Campaign ${campaignId}: encolados ${queued}/${rows.length}`);
    return { queued, totalSelected: rows.length };
  }

  private assertSafeSelect(sql: string) {
    const s = sql.trim().toLowerCase();
    if (!s.startsWith('select'))
      throw new BadRequestException('segment.filter_sql debe empezar con SELECT');
    const forbidden = ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', ';'];
    if (forbidden.some((kw) => s.includes(kw))) {
      throw new BadRequestException('segment.filter_sql contiene palabras no permitidas');
    }
  }

  // agrega tenant guard sobre cases
  private wrapWithTenantGuard(userSql: string) {
    return `
      SELECT * FROM (${userSql}) AS src
      WHERE EXISTS (
        SELECT 1 FROM cases c
        WHERE c.id = src.id AND (c.tenant_id = $1 OR c."tenantId" = $1)
      )
    `;
  }
}
