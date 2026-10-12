import { IsBoolean } from 'class-validator';

export class UpdateSubscriptionDiscountStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
