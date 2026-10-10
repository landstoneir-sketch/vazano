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
