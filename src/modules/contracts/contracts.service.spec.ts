import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ContractsService } from './contracts.service';

const buyer: AuthenticatedUser = {
  id: 'buyer-user',
  mobile: '09120000000',
  status: 'ACTIVE',
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'buyer-org', role: 'BUYER_OWNER' }],
};

const supplier: AuthenticatedUser = {
  id: 'supplier-user',
  mobile: '09120000001',
  status: 'ACTIVE',
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'supplier-org', role: 'SUPPLIER_OWNER' }],
};

const administrator: AuthenticatedUser = {
  id: 'admin-user',
  mobile: '09120000002',
  status: 'ACTIVE',
  permissions: ['contract.manage'],
  globalRoles: ['ADMIN'],
  memberships: [],
};

const acceptedQuotation = {
  id: 'quotation-1',
  supplierOrganizationId: 'supplier-org',
};

const contractRequest = {
  id: 'contract-1',
  code: 'VZC-20261018-ABCDEF12',
  rfqId: 'rfq-1',
  selectedQuotationId: acceptedQuotation.id,
  buyerOrganizationId: 'buyer-org',
  supplierOrganizationId: 'supplier-org',
  requestedByUserId: buyer.id,
  buyerNote: null,
  status: 'REQUESTED',
  termsSummary: null,
};

describe('ContractsService', () => {
  it('rejects creating a request for a user outside the buyer organization', async () => {
    const transaction = jest.fn();
    const prisma = {
      rfq: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rfq-1',
          buyerOrganizationId: 'buyer-org',
          contractRequest: null,
          quotations: [acceptedQuotation],
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);

    await expect(service.createForRfq(supplier, 'rfq-1', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns the existing request instead of creating a duplicate', async () => {
    const transaction = jest.fn();
    const prisma = {
      rfq: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rfq-1',
          buyerOrganizationId: 'buyer-org',
          contractRequest,
          quotations: [acceptedQuotation],
        }),
      },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);

    await expect(service.createForRfq(buyer, 'rfq-1', {})).resolves.toBe(contractRequest);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates an audited request and outbox event after quotation selection', async () => {
    const createdRequest = { ...contractRequest, buyerNote: 'هماهنگی قرارداد درخواست می‌شود.' };
    const tx = {
      contractRequest: { create: jest.fn().mockResolvedValue(createdRequest) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      rfq: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rfq-1',
          buyerOrganizationId: 'buyer-org',
          contractRequest: null,
          quotations: [acceptedQuotation],
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);

    await expect(service.createForRfq(buyer, 'rfq-1', { buyerNote: '  هماهنگی قرارداد درخواست می‌شود.  ' })).resolves.toEqual(createdRequest);
    expect(tx.contractRequest.create).toHaveBeenCalledTimes(1);
    const [createInput] = tx.contractRequest.create.mock.calls[0] as unknown as [{ data: {
      code: string;
      rfqId: string;
      selectedQuotationId: string;
      buyerOrganizationId: string;
      supplierOrganizationId: string;
      requestedByUserId: string;
      buyerNote: string | null;
    } }];
    expect(createInput.data).toEqual({
      code: createInput.data.code,
      rfqId: 'rfq-1',
      selectedQuotationId: acceptedQuotation.id,
      buyerOrganizationId: 'buyer-org',
      supplierOrganizationId: 'supplier-org',
      requestedByUserId: buyer.id,
      buyerNote: 'هماهنگی قرارداد درخواست می‌شود.',
    });
    expect(createInput.data.code).toMatch(/^VZC-\d{8}-[A-F0-9]{8}$/);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const [requestedEvent] = tx.outboxEvent.create.mock.calls[0] as unknown as [{ data: { eventType: string } }];
    expect(requestedEvent.data.eventType).toBe('ir.vazano.contract.requested.v1');
  });

  it('does not disclose a contract request to an unrelated organization', async () => {
    const prisma = {
      contractRequest: { findUnique: jest.fn().mockResolvedValue(contractRequest) },
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);
    const unrelatedUser: AuthenticatedUser = {
      ...buyer,
      id: 'unrelated-user',
      memberships: [{ organizationId: 'other-buyer-org', role: 'BUYER_OWNER' }],
    };

    await expect(service.getForRfq(unrelatedUser, 'rfq-1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getForRfq(supplier, 'rfq-1')).resolves.toBe(contractRequest);
    await expect(service.getForRfq(administrator, 'rfq-1')).resolves.toBe(contractRequest);
  });

  it('accepts prepared terms once and records the transition atomically', async () => {
    const preparedRequest = {
      ...contractRequest,
      status: 'TERMS_PREPARED',
      termsSummary: 'خلاصه شرایط مورد توافق',
      rfq: { buyerOrganizationId: 'buyer-org' },
    };
    const acceptedRequest = { ...preparedRequest, status: 'ACCEPTED' };
    const tx = {
      contractRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(acceptedRequest),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      contractRequest: { findUnique: jest.fn().mockResolvedValue(preparedRequest) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);

    await expect(service.acceptTerms(buyer, 'rfq-1')).resolves.toEqual(acceptedRequest);
    expect(tx.contractRequest.updateMany).toHaveBeenCalledTimes(1);
    const [acceptInput] = tx.contractRequest.updateMany.mock.calls[0] as unknown as [{
      where: { id: string; status: string };
      data: { status: string; acceptedAt: Date };
    }];
    expect(acceptInput.where).toEqual({ id: contractRequest.id, status: 'TERMS_PREPARED' });
    expect(acceptInput.data.status).toBe('ACCEPTED');
    expect(acceptInput.data.acceptedAt).toBeInstanceOf(Date);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    const [acceptedEvent] = tx.outboxEvent.create.mock.calls[0] as unknown as [{ data: { eventType: string } }];
    expect(acceptedEvent.data.eventType).toBe('ir.vazano.contract.accepted.v1');
  });

  it('blocks invalid admin transitions and cancellation without a reason', async () => {
    const prisma = {
      contractRequest: { findUnique: jest.fn().mockResolvedValue(contractRequest) },
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);

    await expect(service.updateAsAdmin(administrator, contractRequest.id, { status: 'TERMS_PREPARED', termsSummary: 'شرایط' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateAsAdmin(administrator, contractRequest.id, { status: 'CANCELLED' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('detects a concurrent terms acceptance', async () => {
    const preparedRequest = {
      ...contractRequest,
      status: 'TERMS_PREPARED',
      termsSummary: 'خلاصه شرایط',
      rfq: { buyerOrganizationId: 'buyer-org' },
    };
    const tx = {
      contractRequest: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };
    const prisma = {
      contractRequest: { findUnique: jest.fn().mockResolvedValue(preparedRequest) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const service = new ContractsService(prisma);

    await expect(service.acceptTerms(buyer, 'rfq-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.auditLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
