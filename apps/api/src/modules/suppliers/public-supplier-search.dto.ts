import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PublicSupplierSearchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;
}
