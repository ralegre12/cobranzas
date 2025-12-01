import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';
import { Channel } from '../../jobs/queues';

export class DispatchOverrideDto {
  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsOptional()
  @IsArray()
  channels?: Channel[];

  @IsOptional()
  @IsInt()
  dailyCap?: number;
}
