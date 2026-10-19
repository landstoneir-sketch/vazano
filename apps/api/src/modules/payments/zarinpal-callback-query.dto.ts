import { IsIn, Matches } from 'class-validator';

export class ZarinpalCallbackQueryDto {
  @Matches(/^A[0-9A-Za-z]{20,64}$/)
  Authority!: string;

  @IsIn(['OK', 'NOK'])
  Status!: 'OK' | 'NOK';
}
