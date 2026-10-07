import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { CmsService } from './cms.service';
import { CreateCmsPageDto, UpdateCmsPageDto } from './cms-page.dto';
import { CreateFaqItemDto, UpdateFaqItemDto } from './faq-item.dto';

@Controller('content')
export class PublicCmsController {
  constructor(private readonly cms: CmsService) {}
  @Get('pages/:slug') getPage(@Param('slug') slug: string) { return this.cms.getPublishedPage(slug); }
  @Get('faqs') listFaqs() { return this.cms.listPublishedFaqs(); }
}

@Controller('admin/content')
@UseGuards(SessionGuard)
export class AdminCmsController {
  constructor(private readonly cms: CmsService) {}
  @Get('pages') listPages(@CurrentUser() user: AuthenticatedUser) { return this.cms.listPages(user); }
  @Post('pages') createPage(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateCmsPageDto) { return this.cms.createPage(user, input); }
  @Put('pages/:id') updatePage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdateCmsPageDto) { return this.cms.updatePage(user, id, input); }
  @Get('faqs') listFaqs(@CurrentUser() user: AuthenticatedUser) { return this.cms.listFaqs(user); }
  @Post('faqs') createFaq(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateFaqItemDto) { return this.cms.createFaq(user, input); }
  @Put('faqs/:id') updateFaq(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdateFaqItemDto) { return this.cms.updateFaq(user, id, input); }
  @Delete('faqs/:id') deleteFaq(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.cms.deleteFaq(user, id); }
}
