import { ContractRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContractRequestDto {
  @IsEnum(ContractRequestStatus)
  status!: ContractRequestStatus;

  @IsString()
  @MaxLength(4000)
  @IsOptional()
  termsSummary?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
