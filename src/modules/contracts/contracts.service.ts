import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContractRequestStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateContractRequestDto } from './create-contract-request.dto';
import { UpdateContractRequestDto } from './update-contract-request.dto';

const adminTransitions: Readonly<Record<string, readonly ContractRequestStatus[]>> = {
  REQUESTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['TERMS_PREPARED', 'CANCELLED'],
  TERMS_PREPARED: ['CANCELLED'],
  ACCEPTED: ['COMPLETED'],
};

const contractInclude = {
  rfq: { select: { id: true, code: true, title: true } },
  selectedQuotation: { select: { id: true, code: true, finalAmountRial: true } },
  buyerOrganization: { select: { id: true, displayName: true } },
  supplierOrganization: { select: { id: true, displayName: true } },
} satisfies Prisma.ContractRequestInclude;

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForRfq(user: AuthenticatedUser, rfqId: string, input: CreateContractRequestDto) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        contractRequest: { include: contractInclude },
        quotations: { where: { status: 'ACCEPTED' }, take: 1 },
      },
    });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    this.requireBuyerMembership(user, rfq.buyerOrganizationId);
    if (rfq.contractRequest) return rfq.contractRequest;
    const selectedQuotation = rfq.quotations[0];
    if (!selectedQuotation) throw new ConflictException('درخواست قرارداد فقط پس از انتخاب پیشنهاد فروشنده امکان‌پذیر است.');
    const buyerNote = input.buyerNote?.trim() || null;
    const code = `VZC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.contractRequest.create({
          data: {
            code,
            rfqId,
            selectedQuotationId: selectedQuotation.id,
            buyerOrganizationId: rfq.buyerOrganizationId,
            supplierOrganizationId: selectedQuotation.supplierOrganizationId,
            requestedByUserId: user.id,
            buyerNote,
          },
          include: contractInclude,
        });
        await tx.auditLog.create({
          data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: 'contract_request.create', entityType: 'ContractRequest', entityId: request.id, metadata: { rfqId, quotationId: selectedQuotation.id, code } },
        });
        await tx.outboxEvent.create({
          data: { aggregateType: 'ContractRequest', aggregateId: request.id, eventType: 'ir.vazano.contract.requested.v1', payload: { requestId: request.id, rfqId, buyerOrganizationId: rfq.buyerOrganizationId, supplierOrganizationId: selectedQuotation.supplierOrganizationId } },
        });
        return request;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.contractRequest.findUniqueOrThrow({ where: { rfqId }, include: contractInclude });
      }
      throw error;
    }
  }

  async getForRfq(user: AuthenticatedUser, rfqId: string) {
    const request = await this.prisma.contractRequest.findUnique({ where: { rfqId }, include: contractInclude });
    if (!request) return null;
    const hasBuyerAccess = user.memberships.some((membership) => membership.organizationId === request.buyerOrganizationId);
    const hasSupplierAccess = user.memberships.some((membership) => membership.organizationId === request.supplierOrganizationId);
    if (!hasBuyerAccess && !hasSupplierAccess && !user.permissions.includes('contract.manage')) {
      throw new ForbiddenException('دسترسی به این درخواست قرارداد مجاز نیست.');
    }
    return request;
  }

  async acceptTerms(user: AuthenticatedUser, rfqId: string) {
    const request = await this.prisma.contractRequest.findUnique({ where: { rfqId }, include: { rfq: { select: { buyerOrganizationId: true } } } });
    if (!request) throw new NotFoundException('درخواست قرارداد پیدا نشد.');
    this.requireBuyerMembership(user, request.rfq.buyerOrganizationId);
    if (request.status === 'ACCEPTED' || request.status === 'COMPLETED') return request;
    if (request.status !== 'TERMS_PREPARED' || !request.termsSummary) throw new ConflictException('شرایط قرارداد هنوز برای تأیید آماده نشده است.');

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.contractRequest.updateMany({ where: { id: request.id, status: 'TERMS_PREPARED' }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      if (changed.count !== 1) throw new ConflictException('وضعیت درخواست هم‌زمان تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: request.buyerOrganizationId, action: 'contract_request.terms.accept', entityType: 'ContractRequest', entityId: request.id } });
      await tx.outboxEvent.create({ data: { aggregateType: 'ContractRequest', aggregateId: request.id, eventType: 'ir.vazano.contract.accepted.v1', payload: { requestId: request.id, rfqId, buyerOrganizationId: request.buyerOrganizationId, supplierOrganizationId: request.supplierOrganizationId } } });
      return tx.contractRequest.findUniqueOrThrow({ where: { id: request.id }, include: contractInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  listForAdmin(user: AuthenticatedUser, status?: ContractRequestStatus) {
    this.requireManagePermission(user);
    if (status && !Object.values(ContractRequestStatus).includes(status)) throw new BadRequestException('وضعیت درخواست قرارداد معتبر نیست.');
    return this.prisma.contractRequest.findMany({
      where: status ? { status } : undefined,
      include: contractInclude,
      orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
      take: 200,
    });
  }

  async updateAsAdmin(user: AuthenticatedUser, requestId: string, input: UpdateContractRequestDto) {
    this.requireManagePermission(user);
    const request = await this.prisma.contractRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('درخواست قرارداد پیدا نشد.');
    const allowed = adminTransitions[request.status] ?? [];
    if (!allowed.includes(input.status)) throw new BadRequestException('این تغییر وضعیت برای درخواست قرارداد مجاز نیست.');
    const termsSummary = input.termsSummary?.trim() || request.termsSummary;
    const note = input.note?.trim() || null;
    if (input.status === 'TERMS_PREPARED' && !termsSummary) throw new BadRequestException('ثبت خلاصه شرایط قرارداد الزامی است.');
    if (input.status === 'CANCELLED' && !note) throw new BadRequestException('ثبت دلیل لغو الزامی است.');
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.contractRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: input.status,
          termsSummary,
          cancellationReason: input.status === 'CANCELLED' ? note : request.cancellationReason,
          reviewedAt: input.status === 'UNDER_REVIEW' ? now : request.reviewedAt,
          termsPreparedAt: input.status === 'TERMS_PREPARED' ? now : request.termsPreparedAt,
          completedAt: input.status === 'COMPLETED' ? now : request.completedAt,
          cancelledAt: input.status === 'CANCELLED' ? now : request.cancelledAt,
        },
      });
      if (changed.count !== 1) throw new ConflictException('وضعیت درخواست هم‌زمان تغییر کرده است؛ فهرست را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: request.buyerOrganizationId, action: `contract_request.status.${input.status.toLowerCase()}`, entityType: 'ContractRequest', entityId: request.id, metadata: { previousStatus: request.status, note } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'ContractRequest', aggregateId: request.id, eventType: `ir.vazano.contract.${input.status.toLowerCase()}.v1`, payload: { requestId: request.id, rfqId: request.rfqId, buyerOrganizationId: request.buyerOrganizationId, supplierOrganizationId: request.supplierOrganizationId, note } } });
      return tx.contractRequest.findUniqueOrThrow({ where: { id: request.id }, include: contractInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private requireBuyerMembership(user: AuthenticatedUser, organizationId: string) {
    const membership = user.memberships.find((item) => item.organizationId === organizationId);
    if (!membership || !['BUYER_OWNER', 'BUYER_MEMBER'].includes(membership.role)) {
      throw new ForbiddenException('فقط اعضای سازمان خریدار می‌توانند این عملیات را انجام دهند.');
    }
  }

  private requireManagePermission(user: AuthenticatedUser) {
    if (!user.permissions.includes('contract.manage')) throw new ForbiddenException('شما مجوز مدیریت درخواست‌های قرارداد را ندارید.');
  }
}
