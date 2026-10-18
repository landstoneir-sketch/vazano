import { SupplierProductStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { ProductSpecificationValue } from '../catalog/product-specification-policy';

export class CreateSupplierProductDto {
  @IsString()
  categoryId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[\p{L}\p{N}._\-/ ]+$/u)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsObject()
  specifications?: Record<string, ProductSpecificationValue>;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  minimumOrderDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  leadTimeDescription?: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsEnum(SupplierProductStatus)
  status?: SupplierProductStatus;
}
