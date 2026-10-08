import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateProvinceDto {
  @IsString()
  @Length(2, 80)
  nameFa!: string;

  @IsString()
  @Length(2, 100)
  @IsOptional()
  nameEn?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsISO8601()
  expectedUpdatedAt!: string;
}
