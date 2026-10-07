import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateNotificationTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  titleTemplate!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  bodyTemplate!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  actionPathTemplate?: string;

  @IsBoolean()
  isActive!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
