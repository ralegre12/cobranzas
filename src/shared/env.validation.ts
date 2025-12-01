// file: src/shared/env.validation.ts
import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, validateSync } from 'class-validator';

class EnvVars {
  @IsString() @IsOptional() NODE_ENV?: string;
  @IsString() @IsOptional() REDIS_URL?: string;
  @IsString() @IsOptional() DB_HOST?: string;
  @IsInt() @IsOptional() DB_PORT?: number;
  @IsString() @IsOptional() DB_USER?: string;
  @IsString() @IsOptional() DB_PASS?: string;
  @IsString() @IsOptional() DB_NAME?: string;

  @IsString() @IsOptional() SMTP_HOST?: string;
  @IsString() @IsOptional() SMTP_USER?: string;
  @IsString() @IsOptional() SMTP_PASS?: string;

  @IsString() @IsOptional() TWILIO_ACCOUNT_SID?: string;
  @IsString() @IsOptional() TWILIO_AUTH_TOKEN?: string;
  @IsString() @IsOptional() TWILIO_FROM?: string;

  @IsString() @IsOptional() WA_ACCESS_TOKEN?: string;
  @IsString() @IsOptional() WA_PHONE_NUMBER_ID?: string;
  @IsString() @IsOptional() WA_APP_SECRET?: string;

  @IsString() @IsOptional() MP_ACCESS_TOKEN?: string;
  @IsString() @IsOptional() MP_WEBHOOK_SECRET?: string;
  @IsString() @IsOptional() MP_NOTIFICATION_URL?: string;

  @IsString() @IsOptional() GLOBAL_PREFIX?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: true });
  if (errors.length) {
    throw new Error(`Config validation error: ${errors.map((e) => e.toString()).join(', ')}`);
  }
  return validated;
}
