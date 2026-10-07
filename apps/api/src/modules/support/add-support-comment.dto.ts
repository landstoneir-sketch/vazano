import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddSupportCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  body!: string;

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}
