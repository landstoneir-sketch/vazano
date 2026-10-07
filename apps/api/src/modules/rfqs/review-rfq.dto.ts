import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum RfqReviewDecision {
  APPROVE = 'APPROVE',
  NEEDS_CHANGES = 'NEEDS_CHANGES',
  REJECT = 'REJECT',
}

export class ReviewRfqDto {
  @IsEnum(RfqReviewDecision)
  decision!: RfqReviewDecision;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  @IsOptional()
  reason?: string;
}
