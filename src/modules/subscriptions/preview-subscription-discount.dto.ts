import { IsString, Matches } from 'class-validator';

export class PreviewSubscriptionDiscountDto {
  @IsString()
  planId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,32}$/)
  discountCode!: string;
}
