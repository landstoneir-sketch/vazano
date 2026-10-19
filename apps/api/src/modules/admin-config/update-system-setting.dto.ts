import { Type } from 'class-transformer';
import { IsDefined, IsInt, Min } from 'class-validator';

export class UpdateSystemSettingDto {
  @IsDefined()
  value!: unknown;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
