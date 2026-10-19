import { SupportTicketCategory, SupportTicketType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsEnum(SupportTicketType)
  type!: SupportTicketType;

  @IsEnum(SupportTicketCategory)
  category!: SupportTicketCategory;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  subjectOrganizationId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  relatedRfqId?: string;
}
