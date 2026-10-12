import { SubscriptionDiscountType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSubscriptionDiscountDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,32}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descriptionFa?: string;

  @IsEnum(SubscriptionDiscountType)
  type!: SubscriptionDiscountType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9000)
  percentageBps?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  fixedAmountRial?: string;

  @IsOptional()
  @IsString()
  applicablePlanId?: string;

  @IsString()
  @Matches(/^\d+$/)
  minimumPurchaseRial!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  perOrganizationLimit!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxRedemptions?: number;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validUntil!: string;

  @IsBoolean()
  isActive!: boolean;
}
