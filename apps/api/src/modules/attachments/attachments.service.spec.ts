import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AttachmentsService } from './attachments.service';

const requester: AuthenticatedUser = {
  id: 'requester-user',
  mobile: '09120000001',
  status: 'ACTIVE',
  permissions: [],
  globalRoles: [],
  memberships: [{ organizationId: 'supplier-organization', role: 'SUPPLIER_OWNER' }],
};

describe('AttachmentsService support payment receipts', () => {
  it('creates an isolated payment-receipt upload intent for the ticket requester', async () => {
    const ticket = {
      id: 'support-ticket-1', requesterUserId: requester.id, organizationId: 'supplier-organization',
      category: 'BILLING', status: 'SUBMITTED',
    };
    const attachment = {
      id: 'attachment-1', organizationId: ticket.organizationId, uploadedByUserId: requester.id,
      rfqId: null, quotationId: null, supplierProfileId: null, supportTicketId: ticket.id,
      purpose: 'PAYMENT_RECEIPT', status: 'PENDING_UPLOAD', bucket: 'vazano-dev', storageKey: 'receipt.pdf',
      originalName: 'receipt.pdf', mimeType: 'application/pdf', sizeBytes: 1024, checksumSha256: null,
      scanProvider: null, scanReason: null, uploadedAt: null, scannedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };
    let attachmentInput: { data: { supportTicketId: string; purpose: string; organizationId: string } } | undefined;
    const prisma = {
      supportTicket: { findUnique: jest.fn().mockResolvedValue(ticket) },
      attachment: { create: jest.fn((input: { data: { supportTicketId: string; purpose: string; organizationId: string } }) => { attachmentInput = input; return Promise.resolve(attachment); }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const storage = { bucket: 'vazano-dev', createUploadUrl: jest.fn().mockResolvedValue('http://storage/upload') };
    const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
    const service = new AttachmentsService(prisma as never, config as never, storage as never, {} as never);

    await expect(service.createSupportTicketUploadIntent(requester, ticket.id, {
      fileName: 'receipt.pdf', mimeType: 'application/pdf', sizeBytes: 1024, purpose: 'PAYMENT_RECEIPT',
    })).resolves.toMatchObject({ attachment: { id: attachment.id }, upload: { url: 'http://storage/upload', method: 'PUT' } });
    expect(attachmentInput?.data.supportTicketId).toBe(ticket.id);
    expect(attachmentInput?.data.purpose).toBe('PAYMENT_RECEIPT');
    expect(attachmentInput?.data.organizationId).toBe(ticket.organizationId);
  });

  it('does not disclose another user ticket through the upload endpoint', async () => {
    const prisma = {
      supportTicket: { findUnique: jest.fn().mockResolvedValue({
        id: 'support-ticket-1', requesterUserId: 'another-user', organizationId: 'supplier-organization',
        category: 'BILLING', status: 'SUBMITTED',
      }) },
      attachment: { create: jest.fn() },
    };
    const service = new AttachmentsService(prisma as never, { get: jest.fn() } as never, {} as never, {} as never);

    await expect(service.createSupportTicketUploadIntent(requester, 'support-ticket-1', {
      fileName: 'receipt.pdf', mimeType: 'application/pdf', sizeBytes: 1024, purpose: 'PAYMENT_RECEIPT',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });
});
