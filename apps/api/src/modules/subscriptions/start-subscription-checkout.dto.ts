import { IsString, MaxLength, MinLength } from 'class-validator';

export class StartSubscriptionCheckoutDto {
  @IsString()
  planId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;
}
