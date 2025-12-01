import { IsNumberString, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateCaseDto {
  @IsString() debtorExternalId: string;
  @IsString() fullName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsNumberString() amountDue: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
