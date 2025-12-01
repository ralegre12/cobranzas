import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendEmailDto {
  @IsEmail()
  to!: string;

  @IsString()
  @MaxLength(140)
  subject!: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  html?: string;
}
