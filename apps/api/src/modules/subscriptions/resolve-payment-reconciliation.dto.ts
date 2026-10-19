import { PaymentReconciliationResolution } from '@prisma/client';
import { IsEnum, IsString, Length } from 'class-validator';

export class ResolvePaymentReconciliationDto {
  @IsEnum(PaymentReconciliationResolution)
  resolution!: PaymentReconciliationResolution;

  @IsString()
  @Length(10, 1_000)
  note!: string;
}
