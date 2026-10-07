import { MemberRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  role!: MemberRole;
}
