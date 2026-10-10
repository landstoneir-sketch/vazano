import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { QualityControlStatus } from '@prisma/client';

export class UpdateQualityControlStatusDto {
  @IsEnum(QualityControlStatus)
  status!: QualityControlStatus;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  note?: string;
}
