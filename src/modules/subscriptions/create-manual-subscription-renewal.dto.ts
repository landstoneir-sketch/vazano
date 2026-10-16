import { IsISO8601, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateManualSubscriptionRenewalDto {
  @IsString()
  @Length(10, 40)
  organizationId!: string;

  @IsString()
  @Length(10, 40)
  planId!: string;

  @IsString()
  @Matches(/^\d{1,18}$/)
  amountRial!: string;

  @IsString()
  @Length(3, 100)
  @Matches(/^[A-Za-z0-9_\-/]+$/)
  trackingNumber!: string;

  @IsISO8601({ strict: true })
  paidAt!: string;

  @IsString()
  @Length(10, 1_000)
  note!: string;

  @IsOptional()
  @IsString()
  @Length(10, 40)
  sourceTicketId?: string;
}
