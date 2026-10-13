import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const manageableGlobalRoles = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'FINANCE', 'CONTENT_MANAGER'] as const;
export type ManageableGlobalRole = typeof manageableGlobalRoles[number];

export class UpdateGlobalRolesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(manageableGlobalRoles.length)
  @IsIn(manageableGlobalRoles, { each: true })
  roles!: ManageableGlobalRole[];

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
