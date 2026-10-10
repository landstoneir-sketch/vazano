import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractRequestDto {
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  buyerNote?: string;
}
