import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) lastName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}
