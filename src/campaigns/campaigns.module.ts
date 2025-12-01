// file: src/campaigns/campaigns.module.ts
import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignsRuntime } from './campaigns.runtime';

@Module({
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsRuntime],
  exports: [CampaignsService],
})
export class CampaignsModule {}
