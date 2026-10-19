import { IsInt, Min } from 'class-validator';
import { CreateSupplierProductDto } from './create-supplier-product.dto';

export class UpdateSupplierProductDto extends CreateSupplierProductDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
