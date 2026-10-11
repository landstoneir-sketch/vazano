import { IsString, MaxLength, MinLength } from 'class-validator';

export class StartQualityControlCheckoutDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;
}
