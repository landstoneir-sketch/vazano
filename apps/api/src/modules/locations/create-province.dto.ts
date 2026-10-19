import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateProvinceDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
