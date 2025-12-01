import { Body, Controller, Get, Param, Post, Put, UsePipes, ValidationPipe } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { UpsertCampaignDto } from './dto/upsert-campaign.dto';
import { DispatchOverrideDto } from './dto/dispatch-override.dto';

@Controller('tenants/:tenantId/campaigns')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get()
  list(@Param('tenantId') tenantId: string) {
    return this.svc.list(tenantId);
  }

  @Get(':id')
  get(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.svc.get(tenantId, id);
  }

  @Post()
  create(@Param('tenantId') tenantId: string, @Body() dto: UpsertCampaignDto) {
    return this.svc.create(tenantId, dto);
  }

  @Put(':id')
  update(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpsertCampaignDto,
  ) {
    return this.svc.update(tenantId, id, dto);
  }

  @Post(':id/ensure-repeatable')
  ensure(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.svc.ensureRepeatable(tenantId, id);
  }

  @Post(':id/dispatch')
  dispatch(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() o: DispatchOverrideDto,
  ) {
    return this.svc.dispatchCampaign(tenantId, id, o);
  }
}
