import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class VerifyOtpDto {
  @IsString() @MaxLength(20) mobile!: string;
  @IsString() @Matches(/^\d{5,6}$/) code!: string;
  @IsEnum(OtpPurpose) purpose!: OtpPurpose;
}
