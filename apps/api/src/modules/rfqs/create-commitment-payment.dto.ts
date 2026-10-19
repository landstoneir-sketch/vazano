import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommitmentPaymentDto {
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey!: string;
}
