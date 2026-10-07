import { MemberRole } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class InviteOrganizationMemberDto {
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  mobile!: string;

  @IsEnum(MemberRole)
  role!: MemberRole;
}
