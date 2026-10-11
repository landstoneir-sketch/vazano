import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateUploadIntentDto } from './create-upload-intent.dto';
import { DEFAULT_MAX_ATTACHMENT_SIZE_BYTES, normalizedAttachmentExtension, safeOriginalFileName } from './attachment-policy';
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

  async downloadUrl(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { rfq: { select: { buyerOrganizationId: true, invitations: { select: { supplierOrganizationId: true } } } } },
    });
    if (!attachment?.rfq || !this.canReadRfq(user, attachment.rfq.buyerOrganizationId, attachment.rfq.invitations.map((item) => item.supplierOrganizationId))) {
      throw new NotFoundException('فایل پیدا نشد.');
    }
    if (attachment.status !== 'READY') throw new ConflictException('فایل هنوز تأیید امنیتی نشده است.');
    const url = await this.storage.createDownloadUrl(attachment.storageKey, attachment.originalName);
    return { url, expiresInSeconds: 300 };
  }

  async remove(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: { rfq: { select: { lifecycleState: true, operationalStatus: true } } },
    });
    if (!attachment || !this.canManageBuyerOrganization(user, attachment.organizationId)) throw new NotFoundException('فایل پیدا نشد.');
    if (!attachment.rfq || attachment.rfq.lifecycleState !== 'DRAFT' || !['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(attachment.rfq.operationalStatus)) {
      throw new ConflictException('حذف فایل پس از ارسال استعلام برای بررسی مجاز نیست.');
    }
    await this.storage.remove(attachment.storageKey);
    await this.prisma.$transaction([
      this.prisma.attachment.update({ where: { id: attachment.id }, data: { status: 'DELETED' } }),
      this.prisma.auditLog.create({ data: { actorUserId: user.id, organizationId: attachment.organizationId, action: 'attachment.delete', entityType: 'Attachment', entityId: attachment.id } }),
    ]);
    return { attachmentId, deleted: true };
  }

  private async findManageableAttachment(user: AuthenticatedUser, attachmentId: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || !this.canManageBuyerOrganization(user, attachment.organizationId)) throw new NotFoundException('فایل پیدا نشد.');
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
