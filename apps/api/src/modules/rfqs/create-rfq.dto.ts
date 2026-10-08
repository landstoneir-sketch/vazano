import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
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

  @IsEnum(RfqEntryMethod)
  @IsOptional()
  entryMethod?: RfqEntryMethod;

  @IsString()
  @IsOptional()
  deliveryProvince?: string;

  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => CreateRfqItemDto)
  items!: CreateRfqItemDto[];
}
