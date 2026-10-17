import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateUploadIntentDto } from './create-upload-intent.dto';
import { DEFAULT_MAX_ATTACHMENT_SIZE_BYTES, matchesAttachmentSignature, normalizedAttachmentExtension, safeOriginalFileName } from './attachment-policy';
import { FileSafetyService } from './file-safety.service';
import { ObjectStorageService } from './object-storage.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: ObjectStorageService,
    private readonly fileSafety: FileSafetyService,
  ) {}

  async createRfqUploadIntent(user: AuthenticatedUser, rfqId: string, input: CreateUploadIntentDto) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { id: true, buyerOrganizationId: true, lifecycleState: true, operationalStatus: true },
    });
    if (!rfq || !this.canManageBuyerOrganization(user, rfq.buyerOrganizationId)) throw new NotFoundException('استعلام پیدا نشد.');
    if (rfq.lifecycleState !== 'DRAFT' || !['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(rfq.operationalStatus)) {
      throw new ConflictException('افزودن فایل فقط تا پیش از ارسال استعلام برای بررسی مجاز است.');
    }
    const maxSizeBytes = this.config.get<number>('ATTACHMENT_MAX_SIZE_BYTES', DEFAULT_MAX_ATTACHMENT_SIZE_BYTES);
    if (input.sizeBytes > maxSizeBytes) throw new BadRequestException(`حداکثر حجم هر فایل ${Math.floor(maxSizeBytes / 1024 / 1024)} مگابایت است.`);
    const extension = normalizedAttachmentExtension(input.fileName, input.mimeType);
    if (!extension) throw new BadRequestException('نوع یا پسوند این فایل مجاز نیست.');

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: rfq.buyerOrganizationId,
        uploadedByUserId: user.id,
        rfqId: rfq.id,
        purpose: input.purpose,
        bucket: this.storage.bucket,
        storageKey: `${rfq.buyerOrganizationId}/rfqs/${rfq.id}/${randomUUID()}${extension}`,
        originalName: safeOriginalFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const uploadUrl = await this.storage.createUploadUrl(attachment.storageKey, attachment.mimeType);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        organizationId: rfq.buyerOrganizationId,
        action: 'attachment.upload_intent.create',
        entityType: 'Attachment',
        entityId: attachment.id,
        metadata: { rfqId: rfq.id, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes },
      },
    });
    return {
      attachment: this.publicAttachment(attachment),
      upload: { url: uploadUrl, method: 'PUT', headers: { 'content-type': attachment.mimeType }, expiresInSeconds: 300 },
    };
  }

  async createQuotationUploadIntent(user: AuthenticatedUser, quotationId: string, input: CreateUploadIntentDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, supplierOrganizationId: true, status: true },
    });
    if (!quotation || !this.canManageQuotation(user, quotation.supplierOrganizationId)) {
      throw new NotFoundException('پیشنهاد قیمت پیدا نشد.');
    }
    if (quotation.status !== 'DRAFT') throw new ConflictException('افزودن فایل فقط به پیش‌نویس پیشنهاد مجاز است.');
    if (!['GENERAL', 'PRODUCT_IMAGE', 'SPECIFICATION', 'PROFORMA'].includes(input.purpose)) {
      throw new BadRequestException('نوع پیوست برای پیشنهاد قیمت مجاز نیست.');
    }
    const maxSizeBytes = this.config.get<number>('ATTACHMENT_MAX_SIZE_BYTES', DEFAULT_MAX_ATTACHMENT_SIZE_BYTES);
    if (input.sizeBytes > maxSizeBytes) throw new BadRequestException(`حداکثر حجم هر فایل ${Math.floor(maxSizeBytes / 1024 / 1024)} مگابایت است.`);
    const extension = normalizedAttachmentExtension(input.fileName, input.mimeType);
    if (!extension) throw new BadRequestException('نوع یا پسوند این فایل مجاز نیست.');

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: quotation.supplierOrganizationId,
        uploadedByUserId: user.id,
        quotationId: quotation.id,
        purpose: input.purpose,
        bucket: this.storage.bucket,
        storageKey: `${quotation.supplierOrganizationId}/quotations/${quotation.id}/${randomUUID()}${extension}`,
        originalName: safeOriginalFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const uploadUrl = await this.storage.createUploadUrl(attachment.storageKey, attachment.mimeType);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        organizationId: quotation.supplierOrganizationId,
        action: 'quotation.attachment.upload_intent.create',
        entityType: 'Attachment',
        entityId: attachment.id,
        metadata: { quotationId: quotation.id, purpose: attachment.purpose, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes },
      },
    });
    return {
      attachment: this.publicAttachment(attachment),
      upload: { url: uploadUrl, method: 'PUT', headers: { 'content-type': attachment.mimeType }, expiresInSeconds: 300 },
    };
  }

  async createSupplierUploadIntent(user: AuthenticatedUser, organizationId: string, input: CreateUploadIntentDto) {
    if (!this.canManageSupplierOrganization(user, organizationId)) throw new NotFoundException('پروفایل فروشنده پیدا نشد.');
    if (input.purpose !== 'CERTIFICATE') throw new BadRequestException('مدارک احراز فروشنده باید با نوع گواهی ثبت شوند.');
    const profile = await this.prisma.supplierProfile.findUnique({ where: { organizationId } });
    if (!profile) throw new NotFoundException('ابتدا اطلاعات پروفایل فروشنده را ثبت کنید.');
    if (['VERIFIED', 'SUSPENDED'].includes(profile.verificationStatus)) {
      throw new ConflictException('افزودن مدرک در وضعیت فعلی پروفایل مجاز نیست.');
    }

    const maxSizeBytes = this.config.get<number>('ATTACHMENT_MAX_SIZE_BYTES', DEFAULT_MAX_ATTACHMENT_SIZE_BYTES);
    if (input.sizeBytes > maxSizeBytes) throw new BadRequestException(`حداکثر حجم هر فایل ${Math.floor(maxSizeBytes / 1024 / 1024)} مگابایت است.`);
    const extension = normalizedAttachmentExtension(input.fileName, input.mimeType);
    if (!extension) throw new BadRequestException('نوع یا پسوند این فایل مجاز نیست.');

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId,
        uploadedByUserId: user.id,
        supplierProfileId: profile.id,
        purpose: 'CERTIFICATE',
        bucket: this.storage.bucket,
        storageKey: `${organizationId}/suppliers/${profile.id}/verification/${randomUUID()}${extension}`,
        originalName: safeOriginalFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const uploadUrl = await this.storage.createUploadUrl(attachment.storageKey, attachment.mimeType);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        organizationId,
        action: 'supplier.verification_document.upload_intent.create',
        entityType: 'Attachment',
        entityId: attachment.id,
        metadata: { supplierProfileId: profile.id, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes },
      },
    });
    return {
      attachment: this.publicAttachment(attachment),
      upload: { url: uploadUrl, method: 'PUT', headers: { 'content-type': attachment.mimeType }, expiresInSeconds: 300 },
    };
  }

  async createSupportTicketUploadIntent(user: AuthenticatedUser, ticketId: string, input: CreateUploadIntentDto) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterUserId: true, organizationId: true, category: true, status: true },
    });
    if (!ticket || ticket.requesterUserId !== user.id || ticket.category !== 'BILLING' || !ticket.organizationId) {
      throw new NotFoundException('درخواست مالی پیدا نشد.');
    }
    if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status)) {
      throw new ConflictException('افزودن رسید به درخواست بسته مجاز نیست.');
    }
    if (input.purpose !== 'PAYMENT_RECEIPT') throw new BadRequestException('فایل این درخواست باید به‌عنوان رسید پرداخت ثبت شود.');
    const maxSizeBytes = this.config.get<number>('ATTACHMENT_MAX_SIZE_BYTES', DEFAULT_MAX_ATTACHMENT_SIZE_BYTES);
    if (input.sizeBytes > maxSizeBytes) throw new BadRequestException(`حداکثر حجم هر فایل ${Math.floor(maxSizeBytes / 1024 / 1024)} مگابایت است.`);
    const extension = normalizedAttachmentExtension(input.fileName, input.mimeType);
    if (!extension) throw new BadRequestException('نوع یا پسوند این فایل مجاز نیست.');

    const attachment = await this.prisma.attachment.create({
      data: {
        organizationId: ticket.organizationId,
        uploadedByUserId: user.id,
        supportTicketId: ticket.id,
        purpose: 'PAYMENT_RECEIPT',
        bucket: this.storage.bucket,
        storageKey: `${ticket.organizationId}/support/${ticket.id}/receipts/${randomUUID()}${extension}`,
        originalName: safeOriginalFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });
    const uploadUrl = await this.storage.createUploadUrl(attachment.storageKey, attachment.mimeType);
    await this.prisma.auditLog.create({ data: {
      actorUserId: user.id,
      organizationId: ticket.organizationId,
      action: 'support.payment_receipt.upload_intent.create',
      entityType: 'Attachment',
      entityId: attachment.id,
      metadata: { ticketId: ticket.id, mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes },
    } });
    return {
      attachment: this.publicAttachment(attachment),
      upload: { url: uploadUrl, method: 'PUT', headers: { 'content-type': attachment.mimeType }, expiresInSeconds: 300 },
    };
  }

  async complete(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.findManageableAttachment(user, attachmentId);
    if (attachment.status === 'READY') return this.publicAttachment(attachment);
    if (!['PENDING_UPLOAD', 'PENDING_SCAN'].includes(attachment.status)) throw new ConflictException('این فایل در وضعیت قابل تکمیل نیست.');

    let object: { sizeBytes: number; mimeType?: string };
    try {
      object = await this.storage.inspect(attachment.storageKey);
    } catch {
      throw new BadRequestException('فایل در فضای ذخیره‌سازی پیدا نشد؛ ابتدا بارگذاری را کامل کنید.');
    }
    if (object.sizeBytes !== attachment.sizeBytes || object.mimeType !== attachment.mimeType) {
      await this.prisma.attachment.update({ where: { id: attachment.id }, data: { status: 'REJECTED', scanReason: 'OBJECT_METADATA_MISMATCH' } });
      throw new BadRequestException('اندازه یا نوع فایل بارگذاری‌شده با درخواست اولیه یکسان نیست.');
    }
    const signature = await this.storage.readPrefix(attachment.storageKey);
    if (!matchesAttachmentSignature(attachment.mimeType, signature)) {
      await this.prisma.$transaction([
        this.prisma.attachment.update({ where: { id: attachment.id }, data: { status: 'REJECTED', scanReason: 'FILE_SIGNATURE_MISMATCH' } }),
        this.prisma.auditLog.create({ data: {
          actorUserId: user.id,
          organizationId: attachment.organizationId,
          action: 'attachment.upload.reject',
          entityType: 'Attachment',
          entityId: attachment.id,
          metadata: { reason: 'FILE_SIGNATURE_MISMATCH', declaredMimeType: attachment.mimeType },
        } }),
      ]);
      throw new BadRequestException('محتوای فایل با نوع اعلام‌شده همخوانی ندارد.');
    }

    const content = this.fileSafety.requiresContent() ? await this.storage.read(attachment.storageKey) : undefined;
    const safety = await this.fileSafety.inspect(content);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.attachment.update({
        where: { id: attachment.id },
        data: {
          status: safety.verdict === 'CLEAN' ? 'READY' : safety.verdict === 'INFECTED' ? 'QUARANTINED' : 'PENDING_SCAN',
          scanProvider: safety.provider,
          scanReason: 'reason' in safety ? safety.reason : null,
          uploadedAt: now,
          scannedAt: safety.verdict === 'PENDING' ? null : now,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: attachment.organizationId,
          action: 'attachment.upload.complete',
          entityType: 'Attachment',
          entityId: attachment.id,
          metadata: { status: result.status, scanProvider: safety.provider, scanReason: 'reason' in safety ? safety.reason : undefined },
        },
      });
      return result;
    });
    return this.publicAttachment(updated);
  }

  async listForRfq(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { buyerOrganizationId: true, invitations: { select: { supplierOrganizationId: true } } },
    });
    if (!rfq || !this.canReadRfq(user, rfq.buyerOrganizationId, rfq.invitations.map((item) => item.supplierOrganizationId))) {
      throw new NotFoundException('استعلام پیدا نشد.');
    }
    const canManage = this.canManageBuyerOrganization(user, rfq.buyerOrganizationId);
    const attachments = await this.prisma.attachment.findMany({
      where: { rfqId, status: canManage ? { not: 'DELETED' } : 'READY' },
      orderBy: { createdAt: 'asc' },
    });
    return attachments.map((attachment) => this.publicAttachment(attachment));
  }

  async listForQuotation(user: AuthenticatedUser, quotationId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { supplierOrganizationId: true, status: true, rfq: { select: { buyerOrganizationId: true } } },
    });
    if (!quotation || !this.canReadQuotation(user, quotation.supplierOrganizationId, quotation.rfq.buyerOrganizationId, quotation.status)) {
      throw new NotFoundException('پیشنهاد قیمت پیدا نشد.');
    }
    const canManage = this.canManageQuotation(user, quotation.supplierOrganizationId);
    const attachments = await this.prisma.attachment.findMany({
      where: { quotationId, status: canManage ? { not: 'DELETED' } : 'READY' },
      orderBy: { createdAt: 'asc' },
    });
    return attachments.map((attachment) => this.publicAttachment(attachment));
  }

  async listForSupplier(user: AuthenticatedUser, organizationId: string) {
    const profile = await this.prisma.supplierProfile.findUnique({ where: { organizationId }, select: { id: true } });
    if (!profile || !this.canReadSupplierDocuments(user, organizationId)) throw new NotFoundException('پروفایل فروشنده پیدا نشد.');
    const attachments = await this.prisma.attachment.findMany({
      where: { supplierProfileId: profile.id, status: { not: 'DELETED' } },
      orderBy: { createdAt: 'asc' },
    });
    return attachments.map((attachment) => this.publicAttachment(attachment));
  }

  async listForSupportTicket(user: AuthenticatedUser, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterUserId: true, category: true },
    });
    if (!ticket || !this.canReadSupportTicket(user, ticket.requesterUserId, ticket.category)) {
      throw new NotFoundException('درخواست پشتیبانی پیدا نشد.');
    }
    const canManage = ticket.requesterUserId === user.id || user.permissions.includes('support.manage');
    const attachments = await this.prisma.attachment.findMany({
      where: { supportTicketId: ticket.id, status: canManage ? { not: 'DELETED' } : 'READY' },
      orderBy: { createdAt: 'asc' },
    });
    return attachments.map((attachment) => this.publicAttachment(attachment));
  }

  async downloadUrl(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        rfq: { select: { buyerOrganizationId: true, invitations: { select: { supplierOrganizationId: true } } } },
        quotation: { select: { supplierOrganizationId: true, status: true, rfq: { select: { buyerOrganizationId: true } } } },
        supplierProfile: { select: { organizationId: true } },
        supportTicket: { select: { requesterUserId: true, category: true } },
      },
    });
    const canReadRfq = attachment?.rfq && this.canReadRfq(user, attachment.rfq.buyerOrganizationId, attachment.rfq.invitations.map((item) => item.supplierOrganizationId));
    const canReadQuotation = attachment?.quotation && this.canReadQuotation(user, attachment.quotation.supplierOrganizationId, attachment.quotation.rfq.buyerOrganizationId, attachment.quotation.status);
    const canReadSupplierDocument = attachment?.supplierProfile && this.canReadSupplierDocuments(user, attachment.supplierProfile.organizationId);
    const canReadSupportDocument = attachment?.supportTicket && this.canReadSupportTicket(user, attachment.supportTicket.requesterUserId, attachment.supportTicket.category);
    if (!attachment || (!canReadRfq && !canReadQuotation && !canReadSupplierDocument && !canReadSupportDocument)) {
      throw new NotFoundException('فایل پیدا نشد.');
    }
    if (attachment.status !== 'READY') throw new ConflictException('فایل هنوز تأیید امنیتی نشده است.');
    const url = await this.storage.createDownloadUrl(attachment.storageKey, attachment.originalName);
    return { url, expiresInSeconds: 300 };
  }

  async remove(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        rfq: { select: { lifecycleState: true, operationalStatus: true } },
        quotation: { select: { supplierOrganizationId: true, status: true } },
        supplierProfile: { select: { organizationId: true, verificationStatus: true } },
        supportTicket: { select: { requesterUserId: true, status: true } },
      },
    });
    const canManageRfq = attachment?.rfq && this.canManageBuyerOrganization(user, attachment.organizationId);
    const canManageQuotation = attachment?.quotation && this.canManageQuotation(user, attachment.quotation.supplierOrganizationId);
    const canManageSupplierDocument = attachment?.supplierProfile && this.canManageSupplierOrganization(user, attachment.supplierProfile.organizationId);
    const canManageSupportDocument = attachment?.supportTicket && (attachment.supportTicket.requesterUserId === user.id || user.permissions.includes('support.manage'));
    if (!attachment || (!canManageRfq && !canManageQuotation && !canManageSupplierDocument && !canManageSupportDocument)) throw new NotFoundException('فایل پیدا نشد.');
    const removableRfq = attachment.rfq?.lifecycleState === 'DRAFT' && ['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(attachment.rfq.operationalStatus);
    const removableQuotation = attachment.quotation?.status === 'DRAFT';
    const removableSupplierDocument = attachment.supplierProfile && !['VERIFIED', 'SUSPENDED'].includes(attachment.supplierProfile.verificationStatus);
    const removableSupportDocument = attachment.supportTicket && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(attachment.supportTicket.status);
    if (!removableRfq && !removableQuotation && !removableSupplierDocument && !removableSupportDocument) {
      throw new ConflictException('حذف این فایل در وضعیت فعلی مجاز نیست.');
    }
    await this.storage.remove(attachment.storageKey);
    await this.prisma.$transaction([
      this.prisma.attachment.update({ where: { id: attachment.id }, data: { status: 'DELETED' } }),
      this.prisma.auditLog.create({ data: { actorUserId: user.id, organizationId: attachment.organizationId, action: 'attachment.delete', entityType: 'Attachment', entityId: attachment.id } }),
    ]);
    return { attachmentId, deleted: true };
  }

  private async findManageableAttachment(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        quotation: { select: { supplierOrganizationId: true, status: true } },
        supplierProfile: { select: { organizationId: true } },
        supportTicket: { select: { requesterUserId: true, status: true } },
      },
    });
    const canManageRfq = attachment?.rfqId && this.canManageBuyerOrganization(user, attachment.organizationId);
    const canManageQuotation = attachment?.quotation && attachment.quotation.status === 'DRAFT'
      && this.canManageQuotation(user, attachment.quotation.supplierOrganizationId);
    const canManageSupplierDocument = attachment?.supplierProfile && this.canManageSupplierOrganization(user, attachment.supplierProfile.organizationId);
    const canManageSupportDocument = attachment?.supportTicket && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(attachment.supportTicket.status)
      && (attachment.supportTicket.requesterUserId === user.id || user.permissions.includes('support.manage'));
    if (!attachment || (!canManageRfq && !canManageQuotation && !canManageSupplierDocument && !canManageSupportDocument)) throw new NotFoundException('فایل پیدا نشد.');
    return attachment;
  }

  private canManageBuyerOrganization(user: AuthenticatedUser, organizationId: string): boolean {
    return user.memberships.some((membership) => membership.organizationId === organizationId && ['BUYER_OWNER', 'BUYER_MEMBER'].includes(membership.role))
      || user.permissions.includes('rfq.manage')
      || user.permissions.includes('rfq.create_on_behalf');
  }

  private canReadRfq(user: AuthenticatedUser, buyerOrganizationId: string, invitedSupplierOrganizationIds: string[]): boolean {
    if (user.permissions.includes('rfq.manage')) return true;
    return user.memberships.some((membership) => membership.organizationId === buyerOrganizationId
      || invitedSupplierOrganizationIds.includes(membership.organizationId));
  }

  private canManageSupplierOrganization(user: AuthenticatedUser, organizationId: string): boolean {
    return user.memberships.some((membership) => membership.organizationId === organizationId
      && ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER'].includes(membership.role));
  }

  private canManageQuotation(user: AuthenticatedUser, organizationId: string): boolean {
    return user.memberships.some((membership) => membership.organizationId === organizationId
      && ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      || user.permissions.includes('quotation.manage');
  }

  private canReadQuotation(user: AuthenticatedUser, supplierOrganizationId: string, buyerOrganizationId: string, status: string): boolean {
    if (user.permissions.includes('quotation.manage')) return true;
    if (user.memberships.some((membership) => membership.organizationId === supplierOrganizationId)) return true;
    if (!['SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVISED'].includes(status)) return false;
    return user.memberships.some((membership) => membership.organizationId === buyerOrganizationId);
  }

  private canReadSupplierDocuments(user: AuthenticatedUser, organizationId: string): boolean {
    return this.canManageSupplierOrganization(user, organizationId) || user.permissions.includes('supplier.verify');
  }

  private canReadSupportTicket(user: AuthenticatedUser, requesterUserId: string, category: string): boolean {
    return requesterUserId === user.id
      || user.permissions.includes('support.manage')
      || (category === 'BILLING' && (user.permissions.includes('billing.read') || user.permissions.includes('billing.manage')));
  }

  private publicAttachment(attachment: {
    id: string;
    purpose: string;
    status: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: attachment.id,
      purpose: attachment.purpose,
      status: attachment.status,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt,
      createdAt: attachment.createdAt,
    };
  }
}
