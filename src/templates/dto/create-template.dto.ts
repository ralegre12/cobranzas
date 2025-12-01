// file: src/templates/dto/create-template.dto.ts
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class CreateTemplateDto {
  @IsString() tenantId!: string; // UUID del tenant
  @IsIn(['WHATSAPP', 'SMS', 'EMAIL']) channel!: 'WHATSAPP' | 'SMS' | 'EMAIL';
  @IsString() @Length(2, 120) code!: string;
  @IsString() @Length(2, 10) locale: string = 'es_AR';
  @IsString() body!: string;
  @IsArray() @IsString({ each: true }) requiredVars: string[] = [];
  @IsOptional() @IsString() providerName?: string;
  @IsOptional() @IsBoolean() isApproved?: boolean = true;
}
