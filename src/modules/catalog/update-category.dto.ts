import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  clearParent?: boolean;

  @IsString()
  @Length(2, 120)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  nameEn?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsISO8601()
  expectedUpdatedAt!: string;
}
