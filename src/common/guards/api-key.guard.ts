import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../../api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeysService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-api-key'] as string | undefined;
    const tenantId = req.params?.tenantId || req.headers['x-tenant-id'];
    if (!key || !tenantId) throw new UnauthorizedException('Missing api key or tenant');
    const ok = await this.apiKeys.verify(tenantId, key);
    if (!ok) throw new UnauthorizedException('Invalid api key');
    return true;
  }
}
