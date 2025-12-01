// file: src/templates/dto/render.dto.ts
import { IsObject, IsOptional, IsString } from 'class-validator';

export class RenderDto {
  @IsString() tenantId!: string;
  @IsString() code!: string;
  @IsString() channel!: 'WHATSAPP' | 'SMS' | 'EMAIL';
  @IsOptional() @IsString() locale?: string;
  @IsObject() vars!: Record<string, string>;
}
