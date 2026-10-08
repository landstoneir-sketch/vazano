import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('industries')
  listIndustries() {
    return this.catalog.listIndustries();
  }

  @Get('categories')
  listCategories(@Query('industryId') industryId?: string) {
    return this.catalog.listCategories(industryId);
  }

  @Get('units')
  listUnits() {
    return this.catalog.listUnits();
  }

  @Get('categories/:categoryId/attributes')
  listCategoryAttributes(@Param('categoryId') categoryId: string) {
    return this.catalog.listCategoryAttributes(categoryId);
  }
}
