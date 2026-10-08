import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @Length(2, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  code!: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
