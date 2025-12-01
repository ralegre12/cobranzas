// file: src/templates/template.service.ts
import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { RedisClientType } from 'redis';

import { MessageTemplate, TemplateChannel } from '../entities/message-template.entity';
import { REDIS } from '../shared/redis.module';

type CacheKey = `tpl:${string}:${string}:${string}:${TemplateChannel}`;

@Injectable()
export class TemplateService {
  private TTL = 300; // 5 min

  constructor(
    @InjectRepository(MessageTemplate) private readonly repo: Repository<MessageTemplate>,
    @Inject(REDIS) private readonly redis: RedisClientType,
  ) {}

  // ---- CRUD básico ----
  findAll(tenantId: string) {
    return this.repo.find({ where: { tenantId }, order: { updatedAt: 'DESC' } as any });
  }

  findOne(tenantId: string, code: string, channel: TemplateChannel, locale = 'es_AR') {
    return this.repo.findOne({ where: { tenantId, code, channel, locale } as any });
  }

  async create(dto: {
    tenantId: string;
    code: string;
    channel: TemplateChannel;
    body: string;
    locale?: string;
    requiredVars?: string[];
    providerName?: string;
    isApproved?: boolean;
  }) {
    const exists = await this.findOne(dto.tenantId, dto.code, dto.channel, dto.locale ?? 'es_AR');
    if (exists) throw new BadRequestException('Template ya existe');
    const entity = this.repo.create({
      tenantId: dto.tenantId,
      code: dto.code,
      channel: dto.channel,
      body: dto.body,
      locale: dto.locale ?? 'es_AR',
      requiredVars: dto.requiredVars ?? [],
      providerName: dto.providerName,
      isApproved: dto.isApproved ?? true,
      version: 1,
    });
    const saved = await this.repo.save(entity);
    await this.invalidateCache(saved);
    return saved;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<MessageTemplate, 'body' | 'requiredVars' | 'locale' | 'isApproved' | 'providerName'>
    >,
  ) {
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Template no encontrado');
    Object.assign(tpl, patch);
    tpl.version = (tpl.version ?? 1) + 1;
    const saved = await this.repo.save(tpl);
    await this.invalidateCache(saved);
    return saved;
  }

  // ---- Render ----

  /** Render plano (reemplazo {{var}}) y validación de variables requeridas */
  async render(
    tenantId: number | string,
    code: string,
    vars: Record<string, string>,
    channel?: TemplateChannel,
    locale = 'es_AR',
  ) {
    // por compat: si no pasaron channel, intentamos orden WHATSAPP>SMS>EMAIL
    const channels: TemplateChannel[] = channel ? [channel] : ['WHATSAPP', 'SMS', 'EMAIL'];
    for (const ch of channels) {
      const tpl = await this.getCached(String(tenantId), code, ch, locale);
      if (!tpl) continue;
      this.assertRequired(tpl.requiredVars, vars);
      return this.interpolate(tpl.body, vars);
    }
    throw new NotFoundException('Template no encontrado');
  }

  /** Render para todos los canales (útil para elegir estrategia de envío). */
  async renderAll(
    tenantId: number | string,
    code: string,
    vars: Record<string, string>,
    locale = 'es_AR',
  ) {
    const res: {
      whatsappVariables: (string | number)[];
      smsText: string | null;
      emailHtml: string | null;
    } = { whatsappVariables: [], smsText: null, emailHtml: null };

    // WHATSAPP → array en orden de requiredVars
    const wa = await this.findOne(String(tenantId), code, 'WHATSAPP', locale);
    if (wa) {
      this.assertRequired(wa.requiredVars, vars);
      res.whatsappVariables = (wa.requiredVars || []).map((k) => vars[k] ?? '');
    }

    // SMS → texto plano interpolado
    const sms = await this.findOne(String(tenantId), code, 'SMS', locale);
    if (sms) {
      this.assertRequired(sms.requiredVars, vars);
      res.smsText = this.interpolate(sms.body, vars);
    }

    // EMAIL → html interpolado
    const em = await this.findOne(String(tenantId), code, 'EMAIL', locale);
    if (em) {
      this.assertRequired(em.requiredVars, vars);
      res.emailHtml = this.interpolate(em.body, vars);
    }

    return res;
  }

  // ---- Helpers ----

  private async getCached(
    tenantId: string,
    code: string,
    channel: TemplateChannel,
    locale: string,
  ) {
    const key: CacheKey = `tpl:${tenantId}:${code}:${locale}:${channel}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as MessageTemplate;

    const tpl = await this.findOne(tenantId, code, channel, locale);
    if (tpl) await this.redis.set(key, JSON.stringify(tpl), { EX: this.TTL });
    return tpl;
  }

  private async invalidateCache(tpl: MessageTemplate) {
    const key: CacheKey = `tpl:${tpl.tenantId}:${tpl.code}:${tpl.locale}:${tpl.channel}`;
    await this.redis.del(key);
  }

  private assertRequired(required: string[] | undefined, vars: Record<string, string>) {
    const req = required ?? [];
    const missing = req.filter((k) => vars[k] === undefined || vars[k] === null);
    if (missing.length) {
      throw new BadRequestException(`Faltan variables requeridas: ${missing.join(', ')}`);
    }
  }

  private interpolate(body: string, vars: Record<string, string>) {
    return (body || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars?.[k] ?? '');
  }
}
