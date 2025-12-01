// src/messaging/messaging-import.service.ts
import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { MessageRepository } from './message.repository';
import { JobsService } from '../jobs/jobs.service';

type Row = {
  phone?: string; // e.g. +54911..., 11-xxxx...
  email?: string; // para canal EMAIL
  name?: string; // “Juan Pérez”
  amount?: string | number; // 12000, 12.000, 12.000,50
  due_date?: string; // dd/mm/yyyy o yyyy-mm-dd
  mp_link?: string; // opcional
  template?: string; // override x fila (si no, defaultTemplate)
  // cualquier otra columna irá a variables extra
};

type ImportOpts = {
  tenantId: string | number;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  defaultTemplate: string;
};

@Injectable()
export class MessagingImportService {
  constructor(
    private readonly msgRepo: MessageRepository,
    private readonly jobs: JobsService,
  ) {}

  async importCsvBuffer(buf: Buffer, opts: ImportOpts) {
    const rows = (parse(buf, {
      bom: true,
      columns: (h: string[]) => h.map((x) => x.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
    }) ?? []) as Row[];

    let enqueued = 0;
    const invalid: Array<{ row: any; reason: string }> = [];

    for (const r of rows) {
      try {
        // --- 1) Destinatario según canal ---
        const to = this.resolveTo(opts.channel, r);
        if (!to) throw new Error(`destinatario inválido para canal ${opts.channel}`);

        // --- 2) Normalización y variables canónicas ---
        const e164 = opts.channel !== 'EMAIL' ? this.toE164(to, 'AR') : undefined;
        if (opts.channel !== 'EMAIL' && !e164) throw new Error('phone inválido');

        const amount = this.normalizeAmount(r.amount);
        const dueISO = this.normalizeDate(r.due_date);
        const template = (r.template || opts.defaultTemplate).toString();

        // variables canónicas (para TemplatesService y SMS/EMAIL)
        const baseVars: Record<string, string> = {
          name: (r.name ?? '').toString(),
          amount: amount ?? '',
          dueDate: dueISO ?? '',
          mpLink: (r.mp_link ?? '').toString(),
        };

        // extra: inyectá cualquier otra columna que venga en el CSV
        const extras = this.pickExtras(r, [
          'phone',
          'email',
          'name',
          'amount',
          'due_date',
          'mp_link',
          'template',
        ]);

        const variablesObj = { ...baseVars, ...extras };

        // Para WhatsApp HSM: array ordenada (si querés otro orden, cambiá acá)
        const variablesArray = [
          variablesObj.name,
          variablesObj.amount,
          variablesObj.dueDate,
          variablesObj.mpLink,
        ].map((v) => (v ?? '').toString());

        // --- 3) Persistimos el message (QUEUED) sin duplicar ---
        const saved = await this.msgRepo.save({
          channel: opts.channel,
          toAddress: opts.channel === 'EMAIL' ? to : e164!,
          templateCode: template,
          variables: {
            ...variablesObj,
            variables: variablesArray,
          },
          status: 'QUEUED',
        });

        // --- 4) Encolamos envío por messageId ---
        await this.jobs.addMessageSend({
          messageId: saved.id,
          channel: opts.channel,
        });

        enqueued++;
      } catch (err: any) {
        invalid.push({ row: r, reason: err?.message || 'error' });
      }
    }

    return { total: rows.length, enqueued, invalid };
  }

  // ========= Helpers =========

  private resolveTo(channel: ImportOpts['channel'], r: Row): string | undefined {
    if (channel === 'EMAIL') return (r.email ?? '').toString().trim();
    return (r.phone ?? '').toString().trim();
  }

  private toE164(raw: string, defaultCountry: string): string | undefined {
    const p = parsePhoneNumberFromString(raw, defaultCountry as any);
    if (!p || !p.isValid()) return undefined;
    return p.number; // +54911...
  }

  private normalizeAmount(v: Row['amount']): string | undefined {
    if (v == null) return undefined;
    const s = String(v)
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    const n = Number(s);
    if (!Number.isFinite(n)) return undefined;
    return n.toFixed(2);
  }

  private normalizeDate(d?: string): string | undefined {
    if (!d) return undefined;
    const s = d.trim();
    // dd/mm/yyyy || dd/mm
    const m = s.match(/\b([0-3]?\d)\/([0-1]?\d)(?:\/(\d{4}))?\b/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3] || new Date().getFullYear());
      const dt = new Date(Date.UTC(year, month - 1, day));
      return isNaN(+dt) ? undefined : dt.toISOString().slice(0, 10);
    }
    // yyyy-mm-dd
    const dt = new Date(s);
    return isNaN(+dt) ? undefined : dt.toISOString().slice(0, 10);
  }

  private pickExtras(row: Record<string, any>, exclude: string[]) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!exclude.includes(k)) out[k] = v == null ? '' : String(v);
    }
    return out;
  }
}
