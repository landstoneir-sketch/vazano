import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMessageThreadDto {
  @IsString()
  @IsNotEmpty()
  rfqId!: string;

  @IsString()
  @IsNotEmpty()
  supplierOrganizationId!: string;
}
