import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Contact } from '../entities/contact.entity';
import { Debt } from '../entities/debt.entity';
import { Case } from '../entities/case.entity';
import { parse as parseCsv } from 'csv-parse/sync';
import * as crypto from 'crypto';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

type ImportRow = {
  externalId: string;
  name?: string;
  phone?: string;
  email?: string;
  reference: string;
  amount: string | number;
  dueDate: string;
  currency?: string;
};

export interface ImportOptions {
  preview?: boolean; // dry-run (valida sin persistir)
  dateFmt?: 'auto' | 'YYYY-MM-DD' | 'DD/MM/YYYY';
  country?: string; // país para E.164 (por defecto AR)
  createCase?: boolean; // crea Case OPEN si no existe
}

export type ImportResult = {
  ok: boolean;
  preview: boolean;
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  fileHash: string;
};

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name);

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Contact) private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Debt) private readonly debtRepo: Repository<Debt>,
    @InjectRepository(Case) private readonly caseRepo: Repository<Case>,
  ) {}

  async importCsv(tenantId: number, file: Buffer, opts: ImportOptions = {}): Promise<ImportResult> {
    if (!file?.length) throw new BadRequestException('Archivo vacío');
    const fileHash = crypto.createHash('sha256').update(file).digest('hex');

    // Parse CSV
    let rows: ImportRow[];
    try {
      rows = parseCsv(file.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as ImportRow[];
    } catch (e) {
      throw new BadRequestException(`CSV inválido: ${(e as Error).message}`);
    }
    if (!rows.length) {
      return { ok: true, preview: !!opts.preview, imported: 0, skipped: 0, errors: [], fileHash };
    }

    // Headers mínimos
    const required = ['externalId', 'reference', 'amount', 'dueDate'] as const;
    const headers = Object.keys(rows[0] || {});
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length) throw new BadRequestException(`Faltan columnas: ${missing.join(', ')}`);

    const preview = !!opts.preview;

    const qr = this.ds.createQueryRunner();
    await qr.connect();

    let imported = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    if (!preview) await qr.startTransaction();
    try {
      let i = 0;
      for (const raw of rows) {
        i++;
        try {
          // Normalización & validación
          const externalId = String(raw.externalId ?? '').trim();
          const fullName = String(raw.name ?? '').trim();
          const email = (raw.email ?? '').toString().trim() || null;
          const phone = this.normalizeE164(String(raw.phone ?? ''), opts.country || 'AR');
          const reference = String(raw.reference ?? '').trim();
          const amount = this.parseAmount(raw.amount);
          const due = this.parseDate(raw.dueDate, opts.dateFmt ?? 'auto');
          const currency = (raw.currency ?? 'ARS').toString().trim().toUpperCase();

          if (!externalId) throw new Error('externalId vacío');
          if (!reference) throw new Error('reference vacío');
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount inválido');
          if (!due.isValid()) throw new Error('dueDate inválido');

          if (preview) {
            imported++;
            continue;
          }

          // ===== Upsert Contact =====
          // NOTA: usamos 'as any' en el where para esquivar diferencias de modelo (tenant vs tenantId, externalId vs customerId, etc.)
          let contact = await qr.manager.findOne(Contact, {
            where: { ...({ tenantId } as any), ...({ externalId } as any) } as any,
          });

          if (!contact) {
            contact = qr.manager.create(Contact, {
              ...({ tenantId } as any),
              ...({ externalId } as any),
              ...(fullName ? { fullName } : {}),
              ...(phone ? { phone } : {}),
              ...(email ? { email } : {}),
              dnc: false,
            } as any);
          } else {
            if (fullName) (contact as any).fullName = (contact as any).fullName || fullName;
            if (phone) (contact as any).phone = (contact as any).phone || phone;
            if (email) (contact as any).email = (contact as any).email || email;
          }
          contact = await qr.manager.save(Contact, contact);

          // ===== Upsert Debt (único por tenant+reference) =====
          let debt = await qr.manager.findOne(Debt, {
            where: { ...({ tenantId } as any), ...({ reference } as any) } as any,
          });

          if (!debt) {
            debt = qr.manager.create(Debt, {
              ...({ tenantId } as any),
              contact,
              ...({ reference } as any),
              // si tu entidad mapea 'numeric' a string, este cast evita error TS
              amount: amount as any,
              dueDate: due.toDate() as any,
              currency,
              status: 'PENDING',
            } as any);
          } else {
            (debt as any).amount = amount as any;
            (debt as any).dueDate = due.toDate() as any;
            (debt as any).currency = currency;
            (debt as any).contact = contact;
          }
          await qr.manager.save(Debt, debt);

          // ===== Asegurar Case abierto =====
          if (opts.createCase !== false) {
            let kase = await qr.manager.findOne(Case, {
              where: {
                ...({ contact: { id: (contact as any).id } } as any),
                status: 'OPEN',
              } as any,
            });
            if (!kase) {
              kase = qr.manager.create(Case, {
                contact,
                status: 'OPEN',
                ...({ tenantId } as any),
              } as any);
              await qr.manager.save(Case, kase);
            }
            // si tu modelo lo permite: (debt as any).case = kase; await qr.manager.save(Debt, debt);
          }

          imported++;
        } catch (e) {
          skipped++;
          errors.push({ row: i, message: (e as Error).message });
        }
      }

      if (!preview) await qr.commitTransaction();
      return { ok: true, preview, imported, skipped, errors, fileHash };
    } catch (e) {
      if (!preview && qr.isTransactionActive) await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // === helpers ===

  private parseAmount(v: string | number): number {
    if (typeof v === 'number') return v;
    const s = (v ?? '').toString().trim();
    if (!s) return NaN;

    // Soporta "1.234,56", "1,234.56", "1234.56", "1234,56"
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    let normalized = s;

    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) {
        normalized = s.replace(/\./g, '').replace(',', '.'); // coma decimal
      } else {
        normalized = s.replace(/,/g, ''); // punto decimal
      }
    } else {
      normalized = s.replace(',', '.'); // único separador: trata coma como decimal
    }

    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }

  private parseDate(v: string, preferred: ImportOptions['dateFmt']) {
    const s = (v ?? '').toString().trim();
    if (!s) return dayjs(''); // <- invalida
    if (preferred === 'YYYY-MM-DD') return dayjs(s, 'YYYY-MM-DD', true);
    if (preferred === 'DD/MM/YYYY') return dayjs(s, 'DD/MM/YYYY', true);
    return dayjs(s, ['YYYY-MM-DD', 'DD/MM/YYYY', 'YYYY/MM/DD'], true);
  }

  private normalizeE164(raw: string, country = 'AR'): string | null {
    const r = (raw ?? '').trim();
    if (!r) return null;
    const digits = r.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    // AR: quitar ceros o 15 iniciales
    let d = digits.replace(/^0+/, '').replace(/^15/, '');
    return `+${this.countryCallingCode(country)}${d}`;
  }

  private countryCallingCode(country: string): string {
    const map: Record<string, string> = {
      AR: '54',
      UY: '598',
      CL: '56',
      BR: '55',
      CO: '57',
      MX: '52',
      US: '1',
      ES: '34',
    };
    return map[country.toUpperCase()] || '54';
  }
}
