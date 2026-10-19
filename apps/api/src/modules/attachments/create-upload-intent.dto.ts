import { AttachmentPurpose } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateUploadIntentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  sizeBytes!: number;

  @IsEnum(AttachmentPurpose)
  purpose!: AttachmentPurpose;
}
