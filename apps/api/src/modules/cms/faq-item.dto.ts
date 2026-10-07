import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateFaqItemDto {
  @IsString() @MinLength(3) @MaxLength(300) questionFa!: string;
  @IsString() @MinLength(3) @MaxLength(10_000) answerFa!: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsInt() @Min(0) sortOrder!: number;
  @IsBoolean() isPublished!: boolean;
}

export class UpdateFaqItemDto extends CreateFaqItemDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
