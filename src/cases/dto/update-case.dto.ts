import { IsEnum, IsOptional } from 'class-validator';
import { CaseStatus } from '../case-status.enum';

export class UpdateCaseDto {
  @IsOptional() @IsEnum(CaseStatus) status?: CaseStatus;
}
