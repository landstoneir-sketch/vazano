import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateCityDto {
  @IsString()
  provinceId!: string;

  @IsString()
  @Length(2, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;

  @IsString()
  @Length(2, 80)
  nameFa!: string;

  @IsString()
  @Length(2, 100)
  @IsOptional()
  nameEn?: string;

  @IsBoolean()
  @IsOptional()
  isProvinceCapital?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
