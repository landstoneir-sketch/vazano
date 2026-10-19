import { Type } from 'class-transformer';
import { IsBoolean, IsISO8601, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class UpdateUnitDto {
  @IsString()
  @Length(1, 80)
  nameFa!: string;

  @IsString()
  @Length(1, 20)
  symbolFa!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(8)
  decimalScale!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsISO8601()
  expectedUpdatedAt!: string;
}
