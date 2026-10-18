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
      type: 'SERVICE_REQUEST', category: 'BILLING', status: 'SUBMITTED',
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
        type: 'SERVICE_REQUEST', category: 'BILLING', status: 'SUBMITTED',
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

describe('AttachmentsService supplier product images', () => {
  it('creates an image upload intent inside the supplier tenant', async () => {
    const attachment = {
      id: 'product-image-1', organizationId: 'supplier-organization', uploadedByUserId: requester.id,
      supplierProductId: 'product-1', purpose: 'PRODUCT_IMAGE', status: 'PENDING_UPLOAD', bucket: 'vazano-dev',
      storageKey: 'supplier-product.webp', originalName: 'stone.webp', mimeType: 'image/webp', sizeBytes: 2048,
      checksumSha256: null, scanProvider: null, scanReason: null, uploadedAt: null, scannedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
    let productAttachmentInput: { data: { organizationId: string; supplierProductId: string; purpose: string } } | undefined;
    const prisma = {
      supplierProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'product-1', status: 'DRAFT', supplierProfile: { organizationId: 'supplier-organization' } }) },
      attachment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn((input: { data: { organizationId: string; supplierProductId: string; purpose: string } }) => {
          productAttachmentInput = input;
          return Promise.resolve(attachment);
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const storage = { bucket: 'vazano-dev', createUploadUrl: jest.fn().mockResolvedValue('http://storage/upload') };
    const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
    const service = new AttachmentsService(prisma as never, config as never, storage as never, {} as never);

    await expect(service.createSupplierProductUploadIntent(requester, 'product-1', {
      fileName: 'stone.webp', mimeType: 'image/webp', sizeBytes: 2048, purpose: 'PRODUCT_IMAGE',
    })).resolves.toMatchObject({ attachment: { id: attachment.id }, upload: { url: 'http://storage/upload' } });
    expect(productAttachmentInput?.data).toMatchObject({ organizationId: 'supplier-organization', supplierProductId: 'product-1', purpose: 'PRODUCT_IMAGE' });
  });

  it('does not disclose another supplier product through the upload endpoint', async () => {
    const prisma = {
      supplierProduct: { findUnique: jest.fn().mockResolvedValue({ id: 'product-2', status: 'DRAFT', supplierProfile: { organizationId: 'another-organization' } }) },
      attachment: { count: jest.fn(), create: jest.fn() },
    };
    const service = new AttachmentsService(prisma as never, { get: jest.fn() } as never, {} as never, {} as never);

    await expect(service.createSupplierProductUploadIntent(requester, 'product-2', {
      fileName: 'stone.jpg', mimeType: 'image/jpeg', sizeBytes: 2048, purpose: 'PRODUCT_IMAGE',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attachment.create).not.toHaveBeenCalled();
  });

  it('exposes only approved images of a publicly eligible product', async () => {
    let productQuery: { where: { status: string; isAvailable: boolean } } | undefined;
    let imageQuery: { where: { status: string; purpose: string } } | undefined;
    const image = {
      id: 'product-image-1', purpose: 'PRODUCT_IMAGE', status: 'READY', originalName: 'stone.webp',
      mimeType: 'image/webp', sizeBytes: 2048, uploadedAt: new Date(), createdAt: new Date(), storageKey: 'product/stone.webp',
    };
    const prisma = {
      supplierProduct: { findFirst: jest.fn((input: { where: { status: string; isAvailable: boolean } }) => { productQuery = input; return Promise.resolve({ id: 'product-1' }); }) },
      attachment: { findMany: jest.fn((input: { where: { status: string; purpose: string } }) => { imageQuery = input; return Promise.resolve([image]); }) },
    };
    const storage = { createViewUrl: jest.fn().mockResolvedValue('http://storage/view') };
    const service = new AttachmentsService(prisma as never, {} as never, storage as never, {} as never);

    const result = await service.listPublicSupplierProductImages('product-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: image.id, url: 'http://storage/view', expiresInSeconds: 300 });
    expect(productQuery?.where).toMatchObject({ status: 'PUBLISHED', isAvailable: true });
    expect(imageQuery?.where).toMatchObject({ status: 'READY', purpose: 'PRODUCT_IMAGE' });
  });
});
