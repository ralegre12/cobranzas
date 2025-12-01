import { IsDateString, IsIn, IsOptional, IsString, Matches } from 'class-validator';
export class CreatePtpDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/) // numeric en texto
  promisedAmount!: string;

  @IsDateString()
  promisedDate!: string;

  @IsOptional()
  @IsIn(['AI', 'AGENT', 'SELF_SERVICE'])
  source?: 'AI' | 'AGENT' | 'SELF_SERVICE' = 'AI';
}
