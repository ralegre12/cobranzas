import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Controller('tenants/:tenantId/api-keys')
export class ApiKeysController {
  constructor(private svc: ApiKeysService) {}
  @Post()
  issue(@Param('tenantId') tenantId: string, @Body('name') name: string) {
    return this.svc.issue(tenantId, name || 'default');
  }
}
