import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, RfqLifecycleState } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UpdateProfileDto } from './update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, mobile: true, email: true, firstName: true, lastName: true, locale: true, status: true, createdAt: true } });
  }
  async dashboardSummary(user: AuthenticatedUser) {
    const buyerOrganizationIds = user.memberships
      .filter((membership) => ['BUYER_OWNER', 'BUYER_MEMBER'].includes(membership.role))
      .map((membership) => membership.organizationId);
    const supplierOrganizationIds = user.memberships
      .filter((membership) => ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      .map((membership) => membership.organizationId);
    const activeRfq = { lifecycleState: { in: [RfqLifecycleState.SUBMITTED, RfqLifecycleState.PUBLISHED] } };

    const [activeBuyerRfqs, buyerRfqsWithQuotes, supplierOpenInvitations, supplierRespondedInvitations, unreadNotifications] = await Promise.all([
      buyerOrganizationIds.length === 0 ? 0 : this.prisma.rfq.count({ where: { buyerOrganizationId: { in: buyerOrganizationIds }, ...activeRfq } }),
      buyerOrganizationIds.length === 0 ? 0 : this.prisma.rfq.count({ where: {
        buyerOrganizationId: { in: buyerOrganizationIds }, ...activeRfq,
        quotations: { some: { status: { in: ['SUBMITTED', 'REVISED', 'ACCEPTED', 'REJECTED'] } } },
      } }),
      supplierOrganizationIds.length === 0 ? 0 : this.prisma.rfqInvitation.count({ where: {
        supplierOrganizationId: { in: supplierOrganizationIds }, status: { in: ['INVITED', 'VIEWED'] },
        rfq: { lifecycleState: 'PUBLISHED', OR: [{ responseDeadline: null }, { responseDeadline: { gt: new Date() } }] },
      } }),
      supplierOrganizationIds.length === 0 ? 0 : this.prisma.rfqInvitation.count({ where: {
        supplierOrganizationId: { in: supplierOrganizationIds }, status: 'RESPONDED',
      } }),
      this.prisma.notification.count({ where: { recipientUserId: user.id, readAt: null, status: 'DELIVERED' } }),
    ]);

    return { activeBuyerRfqs, buyerRfqsWithQuotes, supplierOpenInvitations, supplierRespondedInvitations, unreadNotifications };
  }
  async update(id: string, input: UpdateProfileDto) {
    try {
      return await this.prisma.user.update({ where: { id }, data: input, select: { id: true, mobile: true, email: true, firstName: true, lastName: true, locale: true, status: true } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('این ایمیل قبلاً ثبت شده است.');
      throw error;
    }
  }
}
