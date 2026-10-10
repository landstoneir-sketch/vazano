import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ContractRequestStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { ContractsService } from './contracts.service';
import { CreateContractRequestDto } from './create-contract-request.dto';
import { UpdateContractRequestDto } from './update-contract-request.dto';

@Controller('contracts')
@UseGuards(SessionGuard)
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post('rfqs/:rfqId')
  createForRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string, @Body() input: CreateContractRequestDto) {
    return this.contracts.createForRfq(user, rfqId, input);
  }

  @Get('rfqs/:rfqId')
  getForRfq(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string) {
    return this.contracts.getForRfq(user, rfqId);
  }

  @Post('rfqs/:rfqId/accept-terms')
  acceptTerms(@CurrentUser() user: AuthenticatedUser, @Param('rfqId') rfqId: string) {
    return this.contracts.acceptTerms(user, rfqId);
  }

  @Get('admin/requests')
  listForAdmin(@CurrentUser() user: AuthenticatedUser, @Query('status') status?: ContractRequestStatus) {
    return this.contracts.listForAdmin(user, status);
  }

  @Put('admin/requests/:requestId/status')
  updateAsAdmin(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string, @Body() input: UpdateContractRequestDto) {
    return this.contracts.updateAsAdmin(user, requestId, input);
  }
}
