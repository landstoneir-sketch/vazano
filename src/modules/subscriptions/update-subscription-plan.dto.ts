import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class UpdateSubscriptionPlanDto {
  @IsString()
  @Length(2, 120)
  nameFa!: string;

  @IsOptional()
  @IsString()
  @Length(2, 1_000)
  descriptionFa?: string;

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
  isPublic!: boolean;

  @IsBoolean()
  isActive!: boolean;

  @IsObject()
  entitlements!: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
