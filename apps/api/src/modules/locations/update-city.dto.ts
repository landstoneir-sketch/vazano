import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateCityDto {
  @IsString()
  provinceId!: string;

  @IsString()
  @Length(2, 80)
  nameFa!: string;

  @IsString()
  @Length(2, 100)
  @IsOptional()
  nameEn?: string;

  @IsBoolean()
  isProvinceCapital!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsISO8601()
  expectedUpdatedAt!: string;
}
