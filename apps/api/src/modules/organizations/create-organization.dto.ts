import { OrganizationKind, OrganizationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
export class CreateOrganizationDto {
  @IsEnum(OrganizationKind) kind!: OrganizationKind;
  @IsEnum(OrganizationType) type!: OrganizationType;
  @IsString() @MinLength(2) @MaxLength(180) legalName!: string;
  @IsString() @MinLength(2) @MaxLength(120) displayName!: string;
  @IsOptional() @IsString() @Matches(/^\d{10,11}$/) nationalId?: string;
  @IsOptional() @IsString() @MaxLength(80) province?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
}
