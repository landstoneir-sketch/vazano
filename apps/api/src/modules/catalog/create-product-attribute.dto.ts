import { ProductAttributeDataType } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateProductAttributeDto {
  @IsString()
  @Length(2, 80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;

  @IsString()
  @Length(2, 120)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  nameEn?: string;

  @IsEnum(ProductAttributeDataType)
  dataType!: ProductAttributeDataType;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  unitLabelFa?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
