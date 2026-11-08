import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RfqEntryMethod } from '@prisma/client';

export class CreateRfqItemDto {
  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsNumberString()
  @Matches(/^\d{1,9}(\.\d{1,3})?$/, { message: 'مقدار باید حداکثر ۹ رقم صحیح و ۳ رقم اعشار داشته باشد.' })
  quantity!: string;

  @IsObject()
  @IsOptional()
  specifications?: Record<string, string | number | boolean | string[] | null>;

  @IsNumberString({ no_symbols: true })
  @IsOptional()
  estimatedLineValueRial?: string;
}

export class CreateRfqDto {
  @IsString()
  @IsNotEmpty()
  buyerOrganizationId!: string;

  @IsString()
  @IsOptional()
  buyerContactUserId?: string;

  @IsString()
  @IsNotEmpty()
  primaryDomainId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(160)
  @IsOptional()
  projectName?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  deliveryAddress?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  paymentTerm?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  paymentDetail?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  deliveryTimeMode?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  deliverySchedule?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  deliveryScheduleDetail?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  shippingMode?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  transportCoordinator?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  freightPayer?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  unloadingPayer?: string;

  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @IsOptional()
  purchaseQualityTerms?: string[];

  @IsString()
  @MaxLength(500)
  @IsOptional()
  purchaseQualityTermsOther?: string;

  @IsBoolean()
  @IsOptional()
  financialGuaranteeRequired?: boolean;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  financialGuaranteeDetail?: string;

  @IsEnum(RfqEntryMethod)
  @IsOptional()
  entryMethod?: RfqEntryMethod;

  @IsString()
  @IsOptional()
  deliveryProvinceId?: string;

  @IsString()
  @IsOptional()
  deliveryCityId?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  deliveryProvince?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  deliveryCity?: string;

  @IsDateString()
  @IsOptional()
  requiredAt?: string;

  @IsDateString()
  @IsOptional()
  responseDeadline?: string;

  @IsBoolean()
  @IsOptional()
  installationRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  qualityControlRequested?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateRfqItemDto)
  items!: CreateRfqItemDto[];
}

export class UpdateRfqDto extends CreateRfqDto {
  @IsDateString()
  expectedUpdatedAt!: string;
}
