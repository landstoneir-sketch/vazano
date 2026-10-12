import { SupplierReviewStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class ModerateSupplierReviewDto {
  @IsEnum(SupplierReviewStatus)
  status!: SupplierReviewStatus;

  @IsOptional()
  @IsString()
  @Length(10, 1_000)
  reason?: string;
}
