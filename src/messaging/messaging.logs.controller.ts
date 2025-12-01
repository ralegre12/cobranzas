import { Controller, Get, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between } from 'typeorm';
import { Message } from '@entities/message.entity';
import { MessagingService } from './messaging.service';
import { FastifyReply } from 'fastify';

function parseDateOnly(d?: string): Date | undefined {
  if (!d) return undefined;
  const dt = new Date(d);
  return isNaN(+dt) ? undefined : dt;
}

@Controller('messaging/logs')
export class MessagingLogsController {
  constructor(
    @InjectRepository(Message) private readonly repo: Repository<Message>,
    private readonly messaging: MessagingService,
  ) {}

  @Get()
  async list(
    @Query('channel') channel?: 'WHATSAPP' | 'SMS' | 'EMAIL',
    @Query('status') status?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'ERROR' | 'READ', // 👈 agregado QUEUED
    @Query('to') to?: string,
    @Query('externalId') externalId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    const where: FindOptionsWhere<Message> = {};
    if (channel) (where as any).channel = channel;
    if (status) (where as any).status = status;
    if (to) (where as any).toAddress = to;
    if (externalId) (where as any).externalId = externalId;

    const from = parseDateOnly(dateFrom);
    const toDt = parseDateOnly(dateTo);
    if (from || toDt) {
      const start = from ?? new Date('1970-01-01T00:00:00Z');
      const end = toDt
        ? new Date(new Date(toDt).getTime() + 24 * 60 * 60 * 1000 - 1)
        : new Date('2999-12-31T23:59:59Z');
      (where as any).createdAt = Between(start, end);
    }

    const p = Math.max(parseInt(String(page), 10) || 1, 1);
    const ps = Math.min(Math.max(parseInt(String(pageSize), 10) || 50, 1), 200);
    const [rows, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: ps,
      skip: (p - 1) * ps,
      select: {
        id: true,
        channel: true,
        status: true,
        toAddress: true,
        externalId: true,
        createdAt: true,
        templateCode: true,
      },
    });

    return { rows, total, page: p, pageSize: ps };
  }

  // ⚠️ export.csv debe ir antes de :id para que no lo capture el parámetro dinámico
  @Get('export.csv')
  async exportCsv(
    @Query('channel') channel?: 'WHATSAPP' | 'SMS' | 'EMAIL',
    @Query('status') status?: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'ERROR' | 'READ',
    @Query('q') q?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: FastifyReply,
  ) {
    const qb = this.repo.createQueryBuilder('m').orderBy('m.createdAt', 'DESC');

    if (channel) qb.andWhere('m.channel = :channel', { channel });
    if (status) qb.andWhere('m.status = :status', { status });
    if (q)
      qb.andWhere('(m.toAddress ILIKE :q OR m.externalId ILIKE :q OR m.templateCode ILIKE :q)', {
        q: `%${q}%`,
      });
    if (dateFrom) qb.andWhere('m.createdAt >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('m.createdAt <  :dateTo', { dateTo: `${dateTo}T23:59:59.999Z` });

    const rows = await qb
      .select([
        'm.id',
        'm.channel',
        'm.status',
        'm.toAddress',
        'm.externalId',
        'm.templateCode',
        'm.createdAt',
      ])
      .take(10_000)
      .getMany();

    const header = ['id', 'channel', 'status', 'to', 'externalId', 'template', 'createdAt'];
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = rows.map((r) =>
      [
        r.id,
        r.channel,
        r.status,
        r.toAddress,
        r.externalId,
        r.templateCode,
        r.createdAt.toISOString(),
      ]
        .map(escape)
        .join(','),
    );
    const csv = [header.join(','), ...body].join('\n');

    res!.header('Content-Type', 'text/csv; charset=utf-8');
    res!.header('Content-Disposition', 'attachment; filename="logs.csv"');
    return res!.send(csv);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const msg = await this.repo.findOne({ where: { id: id as any } });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }
}
