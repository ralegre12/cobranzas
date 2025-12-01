// file: src/cases/cases.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/** Tolerancia de redondeo para considerar saldo = 0 */
const EPS = 0.01;

type CaseBalance = { debt: number; paid: number; balance: number };

@Injectable()
export class CasesService {
  private hasAuditColsChecked = false;
  private hasAuditCols = true;
  constructor(private readonly ds: DataSource) {}

  private async ensureCols() {
    if (this.hasAuditColsChecked) return;
    const rows = await this.ds.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='cases' AND column_name IN ('last_inbound_at','last_outbound_at','last_contacted_at')`,
    );
    const set = new Set(rows.map((r: any) => r.column_name));
    this.hasAuditCols = set.has('last_inbound_at') && set.has('last_contacted_at');
    this.hasAuditColsChecked = true;
  }

  async get(caseId: string) {
    const row = (
      await this.ds.query(
        `SELECT *
         FROM cases
        WHERE id = $1
        LIMIT 1`,
        [caseId],
      )
    )?.[0];
    if (!row) throw new BadRequestException('Case not found');
    return row;
  }

  /** Suma de deuda del caso, compatible con ambos esquemas (debts/cases.amount_cents) */
  private async sumDebts(caseId: string): Promise<number> {
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      // 1) deuda 1:1 vía cases.debt_id
      const [{ d1 = 0 } = {}] = await qr.query(
        `SELECT COALESCE(SUM(d.amount),0)::numeric(18,2) AS d1
           FROM debts d
          WHERE d.id = (SELECT debt_id FROM cases WHERE id = $1)`,
        [caseId],
      );

      // 2) deudas N:1 vía debts.case_id / "caseId"
      const [{ d2 = 0 } = {}] = await qr.query(
        `SELECT COALESCE(SUM(d.amount),0)::numeric(18,2) AS d2
           FROM debts d
          WHERE d.case_id = $1 OR d."caseId" = $1`,
        [caseId],
      );

      // 3) fallback: cases.amount_cents (si existe)
      const [{ d3 = 0 } = {}] = await qr.query(
        `SELECT COALESCE(MAX(c.amount_cents)/100.0,0)::numeric(18,2) AS d3
           FROM cases c
          WHERE c.id = $1`,
        [caseId],
      );

      const amount = Number(d1) || Number(d2) || Number(d3) || 0;
      return Number(amount.toFixed(2));
    } finally {
      await qr.release();
    }
  }

  /** Suma de pagos aprobados del caso */
  private async sumApprovedPayments(caseId: string): Promise<number> {
    const [{ p = 0 } = {}] = await this.ds.query(
      `SELECT COALESCE(SUM(amount),0)::numeric(18,2) AS p
         FROM payments
        WHERE case_id = $1
          AND LOWER(COALESCE(status,'pending')) IN ('approved','paid','accredited')`,
      [caseId],
    );
    return Number(Number(p).toFixed(2));
  }

  /** Saldo = deudas - pagos */
  async getBalance(caseId: string): Promise<CaseBalance> {
    const [debt, paid] = await Promise.all([
      this.sumDebts(caseId),
      this.sumApprovedPayments(caseId),
    ]);
    const balance = Number((debt - paid).toFixed(2));
    return { debt, paid, balance };
  }

  /** Marca la última interacción saliente (para cooldown/segmentación) */
  async markContacted(caseId: string) {
    await this.ensureCols();
    if (this.hasAuditCols) {
      await this.ds.query(`UPDATE cases SET last_contacted_at = NOW() WHERE id = $1`, [caseId]);
    } else {
      await this.ds.query(`UPDATE cases SET updated_at = NOW() WHERE id = $1`, [caseId]);
    }
  }
  /** (Opcional) marca última respuesta entrante */
  async markInbound(caseId: string) {
    await this.ensureCols();
    if (this.hasAuditCols) {
      await this.ds.query(`UPDATE cases SET last_inbound_at = NOW() WHERE id = $1`, [caseId]);
    } else {
      // fallback suave
      await this.ds.query(`UPDATE cases SET updated_at = NOW() WHERE id = $1`, [caseId]);
    }
  }

  async markOutbound(caseId: string) {
    await this.ensureCols();
    if (this.hasAuditCols) {
      await this.ds.query(`UPDATE cases SET last_outbound_at = NOW() WHERE id = $1`, [caseId]);
    } else {
      await this.ds.query(`UPDATE cases SET updated_at = NOW() WHERE id = $1`, [caseId]);
    }
  }

  /** Cierra el caso si el saldo es ≈ 0 */
  async closeIfZero(caseId: string) {
    const { balance } = await this.getBalance(caseId);
    if (balance <= EPS) {
      await this.ds.query(
        `UPDATE cases
            SET status = 'PAID',
                closed_at = COALESCE(closed_at, now()),
                updated_at = now()
          WHERE id = $1
            AND status <> 'PAID'`,
        [caseId],
      );
      return { closed: true, balance };
    }
    return { closed: false, balance };
  }

  /** Reabre si el saldo volvió a ser positivo y estaba PAID */
  async reopenIfPositive(caseId: string) {
    const { balance } = await this.getBalance(caseId);
    if (balance > EPS) {
      await this.ds.query(
        `UPDATE cases
            SET status = 'OPEN',
                updated_at = now()
          WHERE id = $1
            AND status = 'PAID'`,
        [caseId],
      );
      return { reopened: true, balance };
    }
    return { reopened: false, balance };
  }

  /** Cambio manual de estado con validación simple */
  async setStatus(caseId: string, status: 'OPEN' | 'PAID' | 'CANCELLED') {
    const allowed = new Set(['OPEN', 'PAID', 'CANCELLED']);
    if (!allowed.has(status)) throw new BadRequestException('Invalid status');
    await this.ds.query(
      `UPDATE cases
          SET status = $2,
              updated_at = now()
        WHERE id = $1`,
      [caseId, status],
    );
    return this.get(caseId);
  }
}
