import { IsOptional, IsString } from 'class-validator';

export class ImportMessagesQueryDto {
  @IsOptional() @IsString() channel?: 'WHATSAPP' | 'SMS' | 'EMAIL';
  @IsOptional() @IsString() defaultTemplate?: string;
}
