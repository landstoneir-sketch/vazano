import { IsEnum, IsString, MaxLength } from 'class-validator';
import { OtpPurpose } from '@prisma/client';

export class RequestOtpDto {
  @IsString() @MaxLength(20) mobile!: string;
  @IsEnum(OtpPurpose) purpose!: OtpPurpose;
}
