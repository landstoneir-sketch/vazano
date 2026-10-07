import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateMessageThreadDto } from './create-message-thread.dto';
import { canAccessMessageThread, canSendAsOrganization } from './message-policies';
import { SendMessageDto } from './send-message.dto';

const messageThreadSummaryInclude = {
  rfq: { select: { id: true, code: true, title: true } },
  buyerOrganization: { select: { id: true, displayName: true } },
  supplierOrganization: { select: { id: true, displayName: true } },
} satisfies Prisma.MessageThreadInclude;

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listThreads(user: AuthenticatedUser) {
    const organizationIds = this.organizationIds(user);
    if (organizationIds.length === 0) return [];

    const threads = await this.prisma.messageThread.findMany({
      where: {
        OR: [
          { buyerOrganizationId: { in: organizationIds } },
          { supplierOrganizationId: { in: organizationIds } },
        ],
      },
      select: {
        id: true,
        status: true,
        buyerOrganizationId: true,
        supplierOrganizationId: true,
        lastMessageAt: true,
        createdAt: true,
        rfq: { select: { id: true, code: true, title: true } },
        buyerOrganization: { select: { id: true, displayName: true } },
        supplierOrganization: { select: { id: true, displayName: true } },
        messages: {
          select: { id: true, body: true, senderUserId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        readStates: { where: { userId: user.id }, select: { lastReadAt: true }, take: 1 },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return Promise.all(threads.map(async (thread) => {
      const lastReadAt = thread.readStates[0]?.lastReadAt;
      const unreadCount = await this.prisma.message.count({
        where: {
          threadId: thread.id,
          senderUserId: { not: user.id },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        },
      });
      return {
        ...thread,
        messages: undefined,
        readStates: undefined,
        lastMessage: thread.messages[0] ?? null,
        unreadCount,
      };
    }));
  }

  async createThread(user: AuthenticatedUser, input: CreateMessageThreadDto) {
    const rfq = await this.prisma.rfq.findFirst({
      where: {
        id: input.rfqId,
        invitations: { some: { supplierOrganizationId: input.supplierOrganizationId } },
      },
      select: { id: true, buyerOrganizationId: true },
    });
    if (!rfq || !this.hasAccess(user, rfq.buyerOrganizationId, input.supplierOrganizationId)) {
      throw new NotFoundException('گفت‌وگوی مرتبط با این استعلام پیدا نشد.');
    }

    const key = {
      rfqId: input.rfqId,
      supplierOrganizationId: input.supplierOrganizationId,
    };
    const existing = await this.prisma.messageThread.findUnique({
      where: { rfqId_supplierOrganizationId: key },
      include: messageThreadSummaryInclude,
    });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const thread = await tx.messageThread.create({
          data: {
            rfqId: input.rfqId,
            buyerOrganizationId: rfq.buyerOrganizationId,
            supplierOrganizationId: input.supplierOrganizationId,
          },
          include: messageThreadSummaryInclude,
        });
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            organizationId: this.currentSideOrganizationId(user, thread),
            action: 'message.thread.open',
            entityType: 'MessageThread',
            entityId: thread.id,
            metadata: { rfqId: thread.rfqId, supplierOrganizationId: thread.supplierOrganizationId },
          },
        });
        return thread;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.messageThread.findUniqueOrThrow({
          where: { rfqId_supplierOrganizationId: key },
          include: messageThreadSummaryInclude,
        });
      }
      throw error;
    }
  }

  async listMessages(user: AuthenticatedUser, threadId: string) {
    await this.findAuthorizedThread(user, threadId);
    return this.prisma.message.findMany({
      where: { threadId },
      select: {
        id: true,
        kind: true,
        body: true,
        senderUserId: true,
        senderOrganizationId: true,
        createdAt: true,
        sender: { select: { firstName: true, lastName: true } },
        senderOrganization: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  async sendMessage(user: AuthenticatedUser, threadId: string, input: SendMessageDto) {
    const thread = await this.findAuthorizedThread(user, threadId);
    if (thread.status !== 'OPEN') throw new ConflictException('این گفت‌وگو بسته شده است.');
    if (!canSendAsOrganization(this.organizationIds(user), thread, input.senderOrganizationId)) {
      throw new NotFoundException('گفت‌وگوی مرتبط با این سازمان پیدا نشد.');
    }
    const body = input.body.trim();
    if (!body) throw new ConflictException('متن پیام نمی‌تواند خالی باشد.');
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          threadId,
          senderUserId: user.id,
          senderOrganizationId: input.senderOrganizationId,
          body,
        },
        select: {
          id: true,
          kind: true,
          body: true,
          senderUserId: true,
          senderOrganizationId: true,
          createdAt: true,
          sender: { select: { firstName: true, lastName: true } },
          senderOrganization: { select: { displayName: true } },
        },
      });
      await tx.messageThread.update({ where: { id: threadId }, data: { lastMessageAt: now } });
      await tx.messageThreadReadState.upsert({
        where: { threadId_userId: { threadId, userId: user.id } },
        create: { threadId, userId: user.id, lastReadAt: now },
        update: { lastReadAt: now },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: input.senderOrganizationId,
          action: 'message.send',
          entityType: 'Message',
          entityId: message.id,
          metadata: { threadId, rfqId: thread.rfqId },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Message',
          aggregateId: message.id,
          eventType: 'ir.vazano.message.sent.v1',
          payload: { messageId: message.id, threadId, rfqId: thread.rfqId },
        },
      });
      return message;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async markRead(user: AuthenticatedUser, threadId: string) {
    await this.findAuthorizedThread(user, threadId);
    const lastReadAt = new Date();
    await this.prisma.messageThreadReadState.upsert({
      where: { threadId_userId: { threadId, userId: user.id } },
      create: { threadId, userId: user.id, lastReadAt },
      update: { lastReadAt },
    });
    return { threadId, read: true, lastReadAt };
  }

  private async findAuthorizedThread(user: AuthenticatedUser, threadId: string) {
    const thread = await this.prisma.messageThread.findUnique({ where: { id: threadId } });
    if (!thread || !this.hasAccess(user, thread.buyerOrganizationId, thread.supplierOrganizationId)) {
      throw new NotFoundException('گفت‌وگو پیدا نشد.');
    }
    return thread;
  }

  private organizationIds(user: AuthenticatedUser): string[] {
    return user.memberships.map((membership) => membership.organizationId);
  }

  private hasAccess(user: AuthenticatedUser, buyerOrganizationId: string, supplierOrganizationId: string): boolean {
    return canAccessMessageThread(this.organizationIds(user), { buyerOrganizationId, supplierOrganizationId });
  }

  private currentSideOrganizationId(
    user: AuthenticatedUser,
    thread: { buyerOrganizationId: string; supplierOrganizationId: string },
  ): string {
    return this.organizationIds(user).find((organizationId) => (
      organizationId === thread.buyerOrganizationId || organizationId === thread.supplierOrganizationId
    ))!;
  }
}
