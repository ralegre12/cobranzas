// file: src/inbound/inbound.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Q_MESSAGE_SEND, Channel, NlpInboundJob } from '../jobs/queues';
import { JobsService } from '../jobs/jobs.service';
import { CasesService } from '../cases/cases.service';

type Intent = 'PTP' | 'BAJA' | 'PAGO' | 'CONSULTA' | 'UNKNOWN';

@Injectable()
export class InboundService {
  constructor(
    private readonly ds: DataSource,
    private readonly jobs: JobsService,
    private readonly cases: CasesService,
  ) {}

  classify(text: string): { intent: Intent; amount?: number; dateISO?: string } {
    const s = (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    // BAJA / DNC
    if (/(baja|no molestar|remover|dejar de|stop|unsubscribe)/.test(s)) return { intent: 'BAJA' };
    // PAGO confirmado
    if (/(ya pague|pague hoy|transferi|pagado|comprobante)/.test(s)) return { intent: 'PAGO' };
    // PTP (monto + fecha)
    const monto = this.extractAmount(s);
    const fecha = this.extractDateISO(s);
    if (/(pago|pagaria|voy a pagar|deposito)/.test(s) && (monto || fecha)) {
      return { intent: 'PTP', amount: monto, dateISO: fecha };
    }
    // Consulta genérica
    if (/(cuanto debo|link|enlace|detalle|ayuda|info|informacion|consulta)/.test(s))
      return { intent: 'CONSULTA' };
    return { intent: 'UNKNOWN' };
  }

  private extractAmount(s: string): number | undefined {
    // 1) Soporte 15k / 15 K
    const sNormK = s.replace(/\b(\d{1,3})(?:\s*)k\b/gi, (_, d: string) => String(Number(d) * 1000));

    // 2) Capturamos TODOS los números candidatos (miles/decimales estilo ES/AR/US)
    //    - "15.000" / "15 000" / "15000"
    //    - "12,34" (decimales con coma)
    //    - "$ 12.345,67"
    const re = /(?:\$|\b)\s*((?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;

    const candidates: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(sNormK)) !== null) {
      const raw = (m[1] || '').trim();

      // Normalizamos: quitamos puntos de miles y pasamos coma decimal a punto
      const normalized = raw.replace(/\./g, '').replace(/\s/g, '').replace(',', '.');

      // Filtrar números que son típicos de fecha (<=31) cuando hay "/" cerca
      // Buscamos si alrededor hay un patrón dd/mm o mm/dd
      const around = sNormK.slice(
        Math.max(0, m.index - 3),
        Math.min(sNormK.length, re.lastIndex + 3),
      );
      const looksLikeDateFragment =
        Number(normalized) <= 31 && /(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*\d{2,4})?/.test(around);

      if (looksLikeDateFragment) continue;

      const n = Number(normalized);
      if (Number.isFinite(n) && n > 0) candidates.push(n);
    }

    if (!candidates.length) return undefined;

    // Elegimos el MAYOR (más robusto con textos que incluyen varios números)
    const best = candidates.reduce((a, b) => (b > a ? b : a), 0);

    // Acotamos a 2 decimales por sanidad
    return Number(best.toFixed(2));
  }

  private extractDateISO(s: string): string | undefined {
    // soporta  dd/mm/yyyy  o  dd/mm
    const m = s.match(/\b([0-3]?\d)\/([0-1]?\d)(?:\/(\d{4}))?\b/);
    if (!m) return;
    const d = Number(m[1]),
      mo = Number(m[2]),
      y = Number(m[3] || new Date().getFullYear());
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (isNaN(dt.getTime())) return;
    return dt.toISOString().slice(0, 10);
  }

  async handle(job: NlpInboundJob) {
    // 1) Resolver caseId (si no vino): por teléfono/email del contacto
    const caseId = job.caseId ?? (await this.findOpenCaseIdByAddress(job.tenantId, job.from));
    if (!caseId) return { ok: false, reason: 'case_not_found' };

    // 2) Marcar inbound
    await this.cases.markInbound(caseId);

    // 3) Clasificar + actuar
    const { intent, amount, dateISO } = this.classify(job.text || '');
    switch (intent) {
      case 'BAJA':
        await this.markDnc(job.tenantId, job.from);
        await this.reply(job.tenantId, caseId, job.channel, 'AUTO_DNC_OK', {});
        return { ok: true, intent };
      case 'PAGO':
        await this.reply(job.tenantId, caseId, job.channel, 'AUTO_PAGO_OK', {});
        return { ok: true, intent };
      case 'PTP':
        if (amount || dateISO) await this.createPtp(caseId, amount, dateISO);
        await this.reply(job.tenantId, caseId, job.channel, 'AUTO_PTP_OK', {
          amount: amount?.toFixed(2) ?? '',
          dueDate: dateISO ?? '',
        });
        return { ok: true, intent, amount, dateISO };
      case 'CONSULTA':
        await this.reply(job.tenantId, caseId, job.channel, 'AUTO_HELP', {});
        return { ok: true, intent };
      default:
        await this.reply(job.tenantId, caseId, job.channel, 'AUTO_HELP', {});
        return { ok: true, intent: 'UNKNOWN' };
    }
  }

  private async findOpenCaseIdByAddress(
    tenantId: string | number,
    addr: string,
  ): Promise<string | undefined> {
    const rows = await this.ds.query(
      `SELECT c.id
       FROM cases c
       JOIN contacts ct ON ct.id = c.contact_id
      WHERE (regexp_replace(coalesce(ct.phone,''),'[^0-9]','','g') = regexp_replace($2,'[^0-9]','','g')
             OR lower(coalesce(ct.email,'')) = lower($2))
        AND ct.tenant_id = $1
        AND c.status = 'ABIERTO'
      ORDER BY c.created_at DESC
      LIMIT 1`,
      [tenantId, addr],
    );
    return rows?.[0]?.id;
  }

  private async markDnc(tenantId: string | number, from: string) {
    await this.ds.query(
      `UPDATE contacts
          SET dnc = true
        WHERE (phone = $2 OR email = $2)
          AND (tenant_id = $1 OR "tenantId" = $1)`,
      [tenantId, from],
    );
  }

  private async createPtp(caseId: string, amount?: number, dateISO?: string) {
    await this.ds.query(
      `INSERT INTO ptp (case_id, promised_amount, promised_date, source, status)
       VALUES ($1, $2, $3::date, 'AI', 'OPEN')`,
      [caseId, amount ?? null, dateISO ?? null],
    );
  }

  private async reply(
    tenantId: string | number,
    caseId: string,
    channel: Channel,
    templateCode: string,
    variables: Record<string, string>,
  ) {
    const toRow = await this.ds.query(
      `SELECT ct.phone, ct.email
       FROM cases c
       LEFT JOIN contacts ct ON ct.id = c.contact_id                 -- 👈 usar contact_id
      WHERE c.id = $1
      LIMIT 1`,
      [caseId],
    );
    const to = channel === 'EMAIL' ? toRow?.[0]?.email : toRow?.[0]?.phone;
    if (!to) return;

    try {
      await this.jobs.addJob(
        Q_MESSAGE_SEND,
        {
          tenantId,
          caseId,
          channel,
          templateCode,
          variables: Object.fromEntries(
            Object.entries(variables || {}).map(([k, v]) => [k, v ?? '']),
          ),
          to,
        },
        { removeOnComplete: true, attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
      );
    } catch {
      // todo: logs
    }
  }
}
