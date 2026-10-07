import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateQuotationItemDto {
  @IsString()
  rfqItemId!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/)
  quantity!: string;

  @IsString()
  @Matches(/^\d+$/)
  unitPriceRial!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  discountRial?: string;

  @IsOptional()
  @IsBoolean()
  isAlternative?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  offeredDescription?: string;
}

export class CreateQuotationDto {
  @IsString()
  rfqId!: string;

  @IsString()
  supplierOrganizationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items!: CreateQuotationItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  paymentTerms?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  preparationDays?: number;

  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  discountRial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  taxRial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  packagingRial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  loadingRial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  shippingRial?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  otherCostsRial?: string;
}
