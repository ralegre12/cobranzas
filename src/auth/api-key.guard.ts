// file: src/auth/api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly ds: DataSource) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (req.url?.startsWith('/webhooks')) return true;
    const apiKey = req.headers['x-api-key'] as string | undefined;
    const tenantId = (req.headers['x-tenant-id'] as string) || (req.params?.tenantId as string);

    if (!apiKey || !tenantId) throw new UnauthorizedException('Missing x-api-key or tenant');

    const rows = await this.ds.query(
      `SELECT id FROM tenants WHERE id = $1 AND api_key = $2 LIMIT 1`,
      [tenantId, apiKey],
    );
    if (!rows?.[0]) throw new UnauthorizedException('Invalid api key');

    // anclamos tenant en request para uso de controllers/servicios
    req.tenantId = tenantId;
    return true;
  }
}
