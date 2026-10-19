import { BillingCycle } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class CreateSubscriptionPlanDto {
  @IsString()
  @Length(3, 80)
  @Matches(/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/)
  code!: string;

  @IsString()
  @Length(2, 120)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @Length(2, 1_000)
  descriptionFa?: string;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;

  @IsString()
  @Matches(/^P(?:(?:1M|3M|6M|1Y)|(?:[1-9]|[1-8][0-9]|90)D)$/)
  durationIso!: string;

  @IsString()
  @Matches(/^\d{1,18}$/)
  priceRial!: string;

  @IsString()
  @Matches(/^\d{1,18}$/)
  grantCredits!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  dailyProposalLimit!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  maxProposalLimit!: number;

  @IsBoolean()
  taxIncluded!: boolean;

  @IsBoolean()
  isTrial!: boolean;

  @IsBoolean()
  isPublic!: boolean;

  @IsBoolean()
  isActive!: boolean;

  @IsObject()
  entitlements!: Record<string, unknown>;
}
