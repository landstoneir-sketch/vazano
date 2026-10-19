import { CmsPublicationStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCmsPageDto {
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(120) slug!: string;
  @IsString() @MinLength(2) @MaxLength(180) titleFa!: string;
  @IsOptional() @IsString() @MaxLength(500) excerptFa?: string;
  @IsString() @MinLength(2) @MaxLength(100_000) bodyFa!: string;
  @IsOptional() @IsString() @MaxLength(180) seoTitleFa?: string;
  @IsOptional() @IsString() @MaxLength(500) seoDescriptionFa?: string;
  @IsEnum(CmsPublicationStatus) status!: CmsPublicationStatus;
}

export class UpdateCmsPageDto extends CreateCmsPageDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
