// file: src/segments/segments.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Segment } from '../entities/segment.entity';

const ALLOWED_TABLES = [
  'cases',
  'contacts',
  'debts',
  'messages',
  'payments',
  'ptp',
  'replies',
  'message_templates',
];
const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|refresh)\b/i;

@Injectable()
export class SegmentsService {
  constructor(
    @InjectRepository(Segment) private readonly repo: Repository<Segment>,
    private readonly ds: DataSource,
  ) {}

  list(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { updatedAt: 'DESC' } as any });
  }

  get(tenantId: string, id: string) {
    return this.repo.findOne({ where: { id, tenantId } as any });
  }

  async create(tenantId: string, dto: { name: string; filterSql: string }) {
    this.validateSql(dto.filterSql);
    const seg = this.repo.create({ ...dto, tenantId });
    return this.repo.save(seg);
  }

  async update(tenantId: string, id: string, dto: Partial<Segment>) {
    if (dto.filterSql) this.validateSql(dto.filterSql);
    const seg = await this.get(tenantId, id);
    if (!seg) throw new BadRequestException('Segment no encontrado');
    Object.assign(seg, dto);
    return this.repo.save(seg);
  }

  async remove(tenantId: string, id: string) {
    await this.repo.delete({ id, tenantId } as any);
    return { ok: true };
  }

  /** Preview: count + sample (safe-guard por tenant) */
  async preview(tenantId: string, filterSql: string, limit = 50) {
    this.validateSql(filterSql);

    const wrapped = this.wrapWithTenantGuard(filterSql, tenantId);
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    try {
      const [{ c = 0 } = {}] = await qr.query(`SELECT COUNT(*)::int AS c FROM (${wrapped}) t`, [
        tenantId,
      ]);
      const sample = await qr.query(`SELECT * FROM (${wrapped}) t LIMIT ${Math.min(limit, 200)}`, [
        tenantId,
      ]);
      return { count: Number(c), sample };
    } finally {
      await qr.release();
    }
  }

  // ---------- helpers ----------

  private validateSql(sql: string) {
    const s = (sql || '').trim();
    if (!/^select\s/i.test(s)) throw new BadRequestException('filterSql debe comenzar con SELECT');
    if (s.includes(';')) throw new BadRequestException('No incluir ";" en filterSql');
    if (FORBIDDEN.test(s))
      throw new BadRequestException('filterSql contiene palabras reservadas no permitidas');

    // whitelist de tablas (FROM/JOIN)
    const lower = s.toLowerCase();
    const re = /\b(from|join)\s+([a-z_][a-z0-9_\.]*)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      const tbl = m[2].split('.').pop()!;
      if (!ALLOWED_TABLES.includes(tbl)) {
        throw new BadRequestException(`Tabla no permitida en filterSql: ${tbl}`);
      }
    }

    // Debe devolver columna 'id'
    if (!/\bselect\b[\s\S]*\bid\b/i.test(s)) {
      throw new BadRequestException(`El SELECT debe devolver una columna 'id' (cases.id)`);
    }
  }

  /** Envolvemos el SELECT del usuario para garantizar tenant scoping
   * Exige que el SELECT devuelva 'id' = cases.id
   */
  private wrapWithTenantGuard(userSql: string, tenantId: string) {
    // Aislamos por tenant mediante EXISTS sobre cases
    // Soporta schemas mixtos (tenant_id o "tenantId")
    return `
      SELECT * FROM (
        ${userSql}
      ) AS src
      WHERE EXISTS (
        SELECT 1 FROM cases c
        WHERE c.id = src.id
          AND (c.tenant_id = $1 OR c."tenantId" = $1)
      )
    `;
  }
}
