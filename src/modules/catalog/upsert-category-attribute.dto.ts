import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpsertCategoryAttributeDto {
  @IsBoolean()
  isRequired!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder!: number;
}
