import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateSubscriptionPlanDto } from './create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './update-subscription-plan.dto';

@Injectable()
export class AdminBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: AuthenticatedUser) {
    this.requireAnyPermission(user, ['billing.read', 'billing.manage']);
    const [plans, subscriptions, payments, receipts, statusGroups] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: [{ isActive: 'desc' }, { priceRial: 'asc' }] }),
      this.prisma.subscription.findMany({
        include: {
          plan: { select: { code: true, nameFa: true } },
          organization: { select: { id: true, displayName: true, legalName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.paymentIntent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.paymentReceipt.findMany({
        include: {
          organization: { select: { id: true, displayName: true, legalName: true } },
          subscription: { select: { plan: { select: { code: true, nameFa: true } } } },
        },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const payerIds = [...new Set(payments.map((payment) => payment.payerOrganizationId).filter((id): id is string => Boolean(id)))];
    const payers = payerIds.length
      ? await this.prisma.organization.findMany({ where: { id: { in: payerIds } }, select: { id: true, displayName: true, legalName: true } })
      : [];
    const payerMap = new Map(payers.map((payer) => [payer.id, payer]));
    return {
      summary: Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all])),
      plans,
      subscriptions,
      payments: payments.map((payment) => ({ ...payment, payerOrganization: payment.payerOrganizationId ? payerMap.get(payment.payerOrganizationId) ?? null : null })),
      receipts,
    };
  }

  async createPlan(user: AuthenticatedUser, input: CreateSubscriptionPlanDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    this.validatePlanAmountsAndLimits(input.priceRial, input.grantCredits, input.dailyProposalLimit, input.maxProposalLimit);
    const entitlements = this.normalizeEntitlements(input.entitlements);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const plan = await tx.subscriptionPlan.create({
          data: {
            code: input.code.trim(),
            nameFa: input.nameFa.trim(),
            descriptionFa: input.descriptionFa?.trim() || null,
            billingCycle: input.billingCycle,
            durationIso: input.durationIso,
            priceRial: BigInt(input.priceRial),
            grantCredits: BigInt(input.grantCredits),
            dailyProposalLimit: input.dailyProposalLimit,
            maxProposalLimit: input.maxProposalLimit,
            taxIncluded: input.taxIncluded,
            isPublic: input.isPublic,
            isActive: input.isActive,
            entitlements,
          },
        });
        await tx.auditLog.create({ data: {
          actorUserId: user.id,
          action: 'subscription_plan.create',
          entityType: 'SubscriptionPlan',
          entityId: plan.id,
          metadata: { code: plan.code, priceRial: plan.priceRial.toString(), version: plan.version },
        } });
        return plan;
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('کد این پلن قبلاً ثبت شده است.');
      throw error;
    }
  }

  async updatePlan(user: AuthenticatedUser, planId: string, input: UpdateSubscriptionPlanDto) {
    this.requireAnyPermission(user, ['billing.manage']);
    this.validatePlanAmountsAndLimits(input.priceRial, input.grantCredits, input.dailyProposalLimit, input.maxProposalLimit);
    const entitlements = this.normalizeEntitlements(input.entitlements);
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('پلن اشتراک پیدا نشد.');

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.subscriptionPlan.updateMany({
        where: { id: plan.id, version: input.expectedVersion },
        data: {
          nameFa: input.nameFa.trim(),
          descriptionFa: input.descriptionFa?.trim() || null,
          priceRial: BigInt(input.priceRial),
          grantCredits: BigInt(input.grantCredits),
          dailyProposalLimit: input.dailyProposalLimit,
          maxProposalLimit: input.maxProposalLimit,
          taxIncluded: input.taxIncluded,
          isPublic: input.isPublic,
          isActive: input.isActive,
          entitlements,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictException('این پلن هم‌زمان تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.');
      await tx.auditLog.create({ data: {
        actorUserId: user.id,
        action: 'subscription_plan.update',
        entityType: 'SubscriptionPlan',
        entityId: plan.id,
        metadata: {
          code: plan.code,
          previousPriceRial: plan.priceRial.toString(),
          newPriceRial: input.priceRial,
          previousVersion: plan.version,
        },
      } });
      return tx.subscriptionPlan.findUniqueOrThrow({ where: { id: plan.id } });
    });
  }

  private validatePlanAmountsAndLimits(priceRial: string, grantCredits: string, dailyLimit: number, maxLimit: number): void {
    if (BigInt(priceRial) <= 0n) throw new BadRequestException('مبلغ پلن باید بیشتر از صفر باشد.');
    if (BigInt(grantCredits) < 0n) throw new BadRequestException('اعتبار پلن نمی‌تواند منفی باشد.');
    if (maxLimit < dailyLimit) throw new BadRequestException('سقف افزایش‌یافته نمی‌تواند کمتر از سقف پایه روزانه باشد.');
  }

  private normalizeEntitlements(value: Record<string, unknown>): Prisma.InputJsonObject {
    const serialized = JSON.stringify(value);
    if (serialized.length > 5_000) throw new BadRequestException('تنظیمات امکانات پلن بیش از حد بزرگ است.');
    return JSON.parse(serialized) as Prisma.InputJsonObject;
  }

  private requireAnyPermission(user: AuthenticatedUser, permissions: string[]): void {
    if (!permissions.some((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('شما مجوز مدیریت مالی و اشتراک‌ها را ندارید.');
    }
  }
}
