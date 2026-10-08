import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateProductAttributeDto {
  @IsString()
  @Length(2, 120)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  unitLabelFa?: string;

  @IsArray()
  @IsString({ each: true })
  options!: string[];

  @IsObject()
  validation!: Record<string, unknown>;

  @IsBoolean()
  isActive!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
