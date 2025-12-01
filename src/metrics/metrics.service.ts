import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Debt } from '../entities/debt.entity';
import { Case } from '../entities/case.entity';
import { Message } from '../entities/message.entity';
import { Payment } from '../entities/payment.entity';
import { Reply } from '../entities/reply.entity';
import { Ptp } from '../entities/ptp.entity';

export type Kpis = {
  recoveryRate: number;
  debtsPending: number;
  interactionsLast7d: number;
  avgDaysToPromise: number;
  totalPaid: number;
};

export type DailySeries = Array<{
  date: string; // YYYY-MM-DD
  debtsPending?: number; // suma de deuda pendiente (snapshot al cierre del día) — opcional
  payments?: number; // suma de pagos del día
  interactions?: number; // replies inbound del día
  ptpCreated?: number; // cantidad PTP creados el día
  ptpKept?: number; // cantidad PTP cumplidos (status KEPT) con fecha ese día
}>;

export type ChannelFunnel = Array<{
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  sent: number;
  replies: number;
  payments: number;
}>;

@Injectable()
export class MetricsService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Debt) private readonly debtRepo: Repository<Debt>,
    @InjectRepository(Case) private readonly caseRepo: Repository<Case>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(Payment) private readonly payRepo: Repository<Payment>,
    @InjectRepository(Reply) private readonly replyRepo: Repository<Reply>,
    @InjectRepository(Ptp) private readonly ptpRepo: Repository<Ptp>,
  ) {}

  /** KPIs instantáneos del tenant */
  async getKpis(tenantId: number): Promise<Kpis> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      const tDebt = this.debtRepo.metadata.tableName;
      const tPay = this.payRepo.metadata.tableName;
      const tCase = this.caseRepo.metadata.tableName;
      const tReply = this.replyRepo.metadata.tableName;
      const tPtp = this.ptpRepo.metadata.tableName;

      // total deuda pendiente (status PENDING)
      const [{ total_pending = 0 } = {}] = await qr.query(
        `SELECT COALESCE(SUM(amount),0)::numeric AS total_pending
         FROM ${tDebt} WHERE tenant_id = $1 AND status = 'PENDING'`,
        [tenantId],
      );

      // total pagado (pagos acreditados) — suma por pagos del tenant
      const [{ total_paid = 0 } = {}] = await qr.query(
        `SELECT COALESCE(SUM(p.amount),0)::numeric AS total_paid
           FROM ${tPay} p
           JOIN ${tCase} c ON c.id = p.case_id
          WHERE c.tenant_id = $1
            AND p.status IN ('approved','paid','accredited')`,
        [tenantId],
      );

      // interacciones últimos 7 días
      const [{ interactions7d = 0 } = {}] = await qr.query(
        `SELECT COUNT(*)::int AS interactions7d
           FROM ${tReply}
          WHERE tenant_id = $1
            AND created_at >= NOW() - INTERVAL '7 days'`,
        [tenantId],
      );

      // días promedio hasta promesa (desde creación del PTP)
      const [{ avg_days_to_promise = 0 } = {}] = await qr.query(
        `SELECT COALESCE(AVG(EXTRACT(DAY FROM (promise_date::timestamp - created_at))),0)::int AS avg_days_to_promise
           FROM ${tPtp}
          WHERE tenant_id = $1
            AND status IN ('OPEN','KEPT')`,
        [tenantId],
      );

      const totalPaidNum = Number(total_paid) || 0;
      const totalPendingNum = Number(total_pending) || 0;
      const recoveryRate =
        totalPaidNum + totalPendingNum > 0 ? totalPaidNum / (totalPaidNum + totalPendingNum) : 0;

      return {
        recoveryRate,
        debtsPending: totalPendingNum,
        interactionsLast7d: Number(interactions7d) || 0,
        avgDaysToPromise: Number(avg_days_to_promise) || 0,
        totalPaid: totalPaidNum,
      };
    } finally {
      await qr.release();
    }
  }

  /** Serie diaria de pagos, interacciones y PTP */
  async getDaily(
    tenantId: number,
    from: string, // 'YYYY-MM-DD'
    to: string, // 'YYYY-MM-DD'
    tz = 'UTC',
  ): Promise<DailySeries> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      const tPay = this.payRepo.metadata.tableName;
      const tReply = this.replyRepo.metadata.tableName;
      const tPtp = this.ptpRepo.metadata.tableName;

      // generate_series por día en TZ, sumas por día
      const series = await qr.query(
        `
        WITH days AS (
          SELECT generate_series(
            (TIMESTAMP WITH TIME ZONE $2 AT TIME ZONE $4)::date,
            (TIMESTAMP WITH TIME ZONE $3 AT TIME ZONE $4)::date,
            INTERVAL '1 day'
          )::date AS d
        ),
        pay AS (
          SELECT (p.created_at AT TIME ZONE $4)::date AS d, COALESCE(SUM(p.amount),0)::numeric AS amount
            FROM ${tPay} p
            JOIN cases c ON c.id = p.case_id
           WHERE c.tenant_id = $1
             AND p.status IN ('approved','paid','accredited')
             AND (p.created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
           GROUP BY 1
        ),
        rep AS (
          SELECT (r.created_at AT TIME ZONE $4)::date AS d, COUNT(*)::int AS qty
            FROM replies r
           WHERE r.tenant_id = $1
             AND (r.created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
           GROUP BY 1
        ),
        ptp_new AS (
          SELECT (p.created_at AT TIME ZONE $4)::date AS d, COUNT(*)::int AS qty
            FROM ${tPtp} p
           WHERE p.tenant_id = $1
             AND (p.created_at AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
           GROUP BY 1
        ),
        ptp_kept AS (
          SELECT (p.promise_date AT TIME ZONE $4)::date AS d, COUNT(*)::int AS qty
            FROM ${tPtp} p
           WHERE p.tenant_id = $1
             AND p.status = 'KEPT'
             AND (p.promise_date AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
           GROUP BY 1
        )
        SELECT to_char(d.d, 'YYYY-MM-DD') AS date,
               COALESCE(pay.amount, 0)     AS payments,
               COALESCE(rep.qty, 0)        AS interactions,
               COALESCE(ptp_new.qty, 0)    AS "ptpCreated",
               COALESCE(ptp_kept.qty, 0)   AS "ptpKept"
          FROM days d
          LEFT JOIN pay      ON pay.d = d.d
          LEFT JOIN rep      ON rep.d = d.d
          LEFT JOIN ptp_new  ON ptp_new.d = d.d
          LEFT JOIN ptp_kept ON ptp_kept.d = d.d
         ORDER BY 1 ASC
        `,
        [tenantId, from, to, tz],
      );

      return series;
    } finally {
      await qr.release();
    }
  }

  /** Funnel por canal: enviados, replies y pagos en rango */
  async getByChannel(tenantId: number, from: string, to: string): Promise<ChannelFunnel> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      const tMsg = this.msgRepo.metadata.tableName;
      const tPay = this.payRepo.metadata.tableName;
      const tCase = this.caseRepo.metadata.tableName;
      const tReply = this.replyRepo.metadata.tableName;

      // enviados por canal
      const sentRows: Array<{ channel: string; qty: number }> = await qr.query(
        `SELECT m.channel, COUNT(*)::int AS qty
           FROM ${tMsg} m
           JOIN ${tCase} c ON c.id = m.case_id
          WHERE c.tenant_id = $1
            AND m.created_at::date BETWEEN $2::date AND $3::date
          GROUP BY m.channel`,
        [tenantId, from, to],
      );

      // replies inbound por canal (intentamos inferir canal por último mensaje del case)
      // Si tenés tracking de canal en reply, reemplazá esta heurística.
      const replyRows: Array<{ channel: string; qty: number }> = await qr.query(
        `SELECT COALESCE(m.channel, 'UNKNOWN') AS channel, COUNT(*)::int AS qty
           FROM ${tReply} r
           LEFT JOIN LATERAL (
             SELECT m2.channel
               FROM ${tMsg} m2
              WHERE m2.case_id = r.case_id
              ORDER BY m2.created_at DESC
              LIMIT 1
           ) m ON TRUE
          WHERE r.tenant_id = $1
            AND r.created_at::date BETWEEN $2::date AND $3::date
          GROUP BY 1`,
        [tenantId, from, to],
      );

      // pagos por canal (heurística: canal del último mensaje antes del pago)
      const payRows: Array<{ channel: string; qty: number }> = await qr.query(
        `SELECT COALESCE(m.channel,'UNKNOWN') AS channel, COUNT(*)::int AS qty
           FROM ${tPay} p
           JOIN ${tCase} c ON c.id = p.case_id
           LEFT JOIN LATERAL (
             SELECT m2.channel
               FROM ${tMsg} m2
              WHERE m2.case_id = p.case_id AND m2.created_at <= p.created_at
              ORDER BY m2.created_at DESC
              LIMIT 1
           ) m ON TRUE
          WHERE c.tenant_id = $1
            AND p.status IN ('approved','paid','accredited')
            AND p.created_at::date BETWEEN $2::date AND $3::date
          GROUP BY 1`,
        [tenantId, from, to],
      );

      const channels: ('WHATSAPP' | 'SMS' | 'EMAIL')[] = ['WHATSAPP', 'SMS', 'EMAIL'];
      const map = new Map<
        string,
        { channel: any; sent: number; replies: number; payments: number }
      >();
      for (const c of channels) map.set(c, { channel: c, sent: 0, replies: 0, payments: 0 });

      for (const r of sentRows)
        map.set(r.channel, {
          ...(map.get(r.channel) ?? { channel: r.channel, sent: 0, replies: 0, payments: 0 }),
          sent: r.qty,
        });
      for (const r of replyRows)
        map.set(r.channel, {
          ...(map.get(r.channel) ?? { channel: r.channel, sent: 0, replies: 0, payments: 0 }),
          replies: r.qty,
        });
      for (const r of payRows)
        map.set(r.channel, {
          ...(map.get(r.channel) ?? { channel: r.channel, sent: 0, replies: 0, payments: 0 }),
          payments: r.qty,
        });

      return Array.from(map.values()).filter((r) => r.channel !== 'UNKNOWN') as any;
    } finally {
      await qr.release();
    }
  }
}
