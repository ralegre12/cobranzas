import { CacheInterceptor } from '@nestjs/cache-manager';
import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import dayjs from 'dayjs';
import { MetricsService } from './metrics.service';
import { RangeDto } from './dto/range.dto';

@UseInterceptors(CacheInterceptor)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly svc: MetricsService) {}

  @Get('tenant/:tenantId')
  async kpis(@Param('tenantId') tenantId: string) {
    return this.svc.getKpis(+tenantId);
  }

  @Get('tenant/:tenantId/daily')
  async daily(@Param('tenantId') tenantId: string, @Query() q: RangeDto) {
    const to = q.to ?? dayjs().format('YYYY-MM-DD');
    const from = q.from ?? dayjs(to).subtract(30, 'day').format('YYYY-MM-DD'); // default 30d
    const tz = q.tz ?? 'UTC';
    return this.svc.getDaily(+tenantId, from, to, tz);
  }

  @Get('tenant/:tenantId/by-channel')
  async byChannel(@Param('tenantId') tenantId: string, @Query() q: RangeDto) {
    const to = q.to ?? dayjs().format('YYYY-MM-DD');
    const from = q.from ?? dayjs(to).subtract(30, 'day').format('YYYY-MM-DD');
    return this.svc.getByChannel(+tenantId, from, to);
  }
}
