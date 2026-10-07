import { SupplierVerificationStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifySupplierDto {
  @IsEnum(SupplierVerificationStatus)
  status!: SupplierVerificationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
