import { IsArray, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { Channel } from '../../jobs/queues';

export class UpsertCampaignDto {
  @IsString()
  name!: string;

  @IsString()
  segmentId!: string;

  @IsOptional()
  @IsArray()
  channelPriority?: Channel[];

  @IsOptional()
  @IsInt()
  dailyCap?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'])
  status?: 'ACTIVE' | 'PAUSED';

  @IsOptional()
  @IsString()
  scheduleCron?: string | null;

  @IsOptional()
  @IsString()
  templateCode?: string | null;
}
