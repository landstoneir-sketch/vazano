import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AdminCatalogService } from './admin-catalog.service';
import { CreateCategoryDto } from './create-category.dto';
import { CreateProductAttributeDto } from './create-product-attribute.dto';
import { CreateUnitDto } from './create-unit.dto';
import { UpdateCategoryDto } from './update-category.dto';
import { UpdateProductAttributeDto } from './update-product-attribute.dto';
import { UpdateUnitDto } from './update-unit.dto';
import { UpsertCategoryAttributeDto } from './upsert-category-attribute.dto';

@Controller('admin/catalog')
@UseGuards(SessionGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get('categories')
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listCategories(user);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(user, input);
  }

  @Put('categories/:categoryId')
  updateCategory(@CurrentUser() user: AuthenticatedUser, @Param('categoryId') categoryId: string, @Body() input: UpdateCategoryDto) {
    return this.catalog.updateCategory(user, categoryId, input);
  }

  @Get('attributes')
  listAttributes(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listAttributes(user);
  }

  @Get('units')
  listUnits(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listUnits(user);
  }

  @Post('units')
  createUnit(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateUnitDto) {
    return this.catalog.createUnit(user, input);
  }

  @Put('units/:unitId')
  updateUnit(@CurrentUser() user: AuthenticatedUser, @Param('unitId') unitId: string, @Body() input: UpdateUnitDto) {
    return this.catalog.updateUnit(user, unitId, input);
  }

  @Post('attributes')
  createAttribute(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateProductAttributeDto) {
    return this.catalog.createAttribute(user, input);
  }

  @Put('attributes/:attributeId')
  updateAttribute(@CurrentUser() user: AuthenticatedUser, @Param('attributeId') attributeId: string, @Body() input: UpdateProductAttributeDto) {
    return this.catalog.updateAttribute(user, attributeId, input);
  }

  @Put('categories/:categoryId/attributes/:attributeId')
  upsertBinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId') categoryId: string,
    @Param('attributeId') attributeId: string,
    @Body() input: UpsertCategoryAttributeDto,
  ) {
    return this.catalog.upsertBinding(user, categoryId, attributeId, input);
  }

  @Delete('categories/:categoryId/attributes/:attributeId')
  removeBinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId') categoryId: string,
    @Param('attributeId') attributeId: string,
  ) {
    return this.catalog.removeBinding(user, categoryId, attributeId);
  }
}
