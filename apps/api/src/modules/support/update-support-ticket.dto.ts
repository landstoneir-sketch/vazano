import { SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSupportTicketDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  resolution?: string;

  @IsString()
  @MaxLength(3000)
  @IsOptional()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  isInternalComment?: boolean;
}
