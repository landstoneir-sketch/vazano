import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class SupplierCategoryDto {
  @IsString()
  categoryId!: string;
}

export class UpsertSupplierProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  productionCapacityDescription?: string;

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
  officialInvoiceAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  sampleAvailable?: boolean;

  @IsOptional()
  @IsBoolean()
  installationAvailable?: boolean;

  @IsBoolean()
  nationwideCoverage!: boolean;

  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  serviceProvinceIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SupplierCategoryDto)
  categories!: SupplierCategoryDto[];
}
