import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RfqSource } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateRfqDto } from './create-rfq.dto';
import { BUYER_COMMITMENT_AMOUNT_RIAL, BUYER_COMMITMENT_POLICY_VERSION, QUALITY_CONTROL_FEE_BPS } from './rfq-policies';
import { canPublishRfq } from './rfq-policies';
import { RfqReviewDecision, ReviewRfqDto } from './review-rfq.dto';
import { PaymentsService } from '../payments/payments.service';

const categoryDetailsInclude = {
  attributeBindings: {
    where: { attribute: { isActive: true } },
    include: { attribute: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

@Injectable()
export class RfqsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  listForUser(user: AuthenticatedUser) {
    const buyerOrganizationIds = user.memberships
      .filter((membership) => membership.role === 'BUYER_OWNER' || membership.role === 'BUYER_MEMBER')
      .map((membership) => membership.organizationId);
    return this.prisma.rfq.findMany({
      where: { buyerOrganizationId: { in: buyerOrganizationIds } },
      include: { items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } }, _count: { select: { quotations: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  listMatchedForSupplier(user: AuthenticatedUser) {
    const supplierOrganizationIds = user.memberships
      .filter((membership) => ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      .map((membership) => membership.organizationId);
    return this.prisma.rfqInvitation.findMany({
      where: { supplierOrganizationId: { in: supplierOrganizationIds }, status: { in: ['INVITED', 'VIEWED', 'RESPONDED'] } },
      include: {
        supplierOrganization: { select: { id: true, displayName: true } },
        rfq: {
          include: {
            buyerOrganization: { select: { id: true, displayName: true, province: true, city: true } },
            items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } },
            quotations: { where: { supplierOrganizationId: { in: supplierOrganizationIds } }, select: { id: true, status: true, version: true, finalAmountRial: true } },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });
  }

  async getOne(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: {
        buyerOrganization: { select: { id: true, displayName: true, province: true, city: true } },
        items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } },
        invitations: { select: { supplierOrganizationId: true, status: true } },
        _count: { select: { quotations: true } },
      },
    });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const buyerAccess = user.memberships.some((membership) => membership.organizationId === rfq.buyerOrganizationId);
    const supplierOrganizationIds = user.memberships
      .filter((membership) => ['SUPPLIER_OWNER', 'SUPPLIER_MANAGER', 'SUPPLIER_SALES'].includes(membership.role))
      .map((membership) => membership.organizationId);
    const supplierAccess = rfq.invitations.some((invitation) => supplierOrganizationIds.includes(invitation.supplierOrganizationId));
    if (!buyerAccess && !supplierAccess && !user.permissions.includes('rfq.manage')) throw new ForbiddenException('دسترسی به این استعلام مجاز نیست.');
    return rfq;
  }

  listReviewQueue(user: AuthenticatedUser) {
    if (!user.permissions.includes('rfq.review')) throw new ForbiddenException('مجوز مشاهده صف بررسی را ندارید.');
    return this.prisma.rfq.findMany({
      where: {
        OR: [
          { approvalStatus: 'PENDING', operationalStatus: 'UNDER_REVIEW' },
          { approvalStatus: 'APPROVED', operationalStatus: { in: ['WAITING_COMMITMENT', 'READY_TO_PUBLISH'] } },
        ],
      },
      include: {
        buyerOrganization: { select: { id: true, displayName: true, province: true, city: true } },
        buyerContact: { select: { id: true, firstName: true, lastName: true, mobile: true } },
        items: { include: { category: { include: categoryDetailsInclude }, unit: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  createSelfService(user: AuthenticatedUser, input: CreateRfqDto) {
    return this.create(user, input, RfqSource.BUYER_SELF_SERVICE);
  }

  createOnBehalf(user: AuthenticatedUser, input: CreateRfqDto) {
    if (!user.permissions.includes('rfq.create_on_behalf')) {
      throw new ForbiddenException('مجوز ثبت استعلام به نمایندگی از خریدار را ندارید.');
    }
    if (!input.buyerContactUserId) {
      throw new BadRequestException('انتخاب کاربر خریدار برای ثبت توسط اپراتور الزامی است.');
    }
    return this.create(user, input, RfqSource.PLATFORM_OPERATOR);
  }

  async submit(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.findAuthorizedRfq(user, rfqId);
    if (rfq.lifecycleState !== 'DRAFT' || !['DRAFT_INCOMPLETE', 'NEEDS_CHANGES'].includes(rfq.operationalStatus)) {
      throw new ConflictException('این استعلام در وضعیت قابل ارسال نیست.');
    }
    if (rfq.items.length === 0) throw new BadRequestException('استعلام باید حداقل یک ردیف داشته باشد.');
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.rfq.update({
        where: { id: rfqId },
        data: { lifecycleState: 'SUBMITTED', operationalStatus: 'UNDER_REVIEW', approvalStatus: 'PENDING', submittedAt: now },
      });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: 'rfq.submit_for_review', entityType: 'Rfq', entityId: rfqId } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: 'ir.vazano.rfq.submitted.v1', payload: { rfqId } } });
      return result;
    });
    return updated;
  }

  async review(user: AuthenticatedUser, rfqId: string, input: ReviewRfqDto) {
    if (!user.permissions.includes('rfq.review')) throw new ForbiddenException('مجوز بررسی استعلام را ندارید.');
    if (input.decision !== RfqReviewDecision.APPROVE && !input.reason) throw new BadRequestException('ثبت دلیل برای بازگشت یا رد الزامی است.');
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    if (rfq.lifecycleState !== 'SUBMITTED' || rfq.approvalStatus !== 'PENDING') throw new ConflictException('استعلام در صف بررسی نیست.');
    const approvalStatus = input.decision === RfqReviewDecision.APPROVE
      ? 'APPROVED'
      : (input.decision === RfqReviewDecision.NEEDS_CHANGES ? 'NEEDS_CHANGES' : 'REJECTED');
    const operationalStatus = input.decision === RfqReviewDecision.APPROVE
      ? (rfq.commitmentStatus === 'NOT_REQUIRED' ? 'READY_TO_PUBLISH' : 'WAITING_COMMITMENT')
      : (input.decision === RfqReviewDecision.NEEDS_CHANGES ? 'NEEDS_CHANGES' : 'CANCELLED');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.rfq.update({
        where: { id: rfqId },
        data: {
          approvalStatus,
          operationalStatus,
          lifecycleState: input.decision === RfqReviewDecision.REJECT ? 'CANCELLED' : (input.decision === RfqReviewDecision.NEEDS_CHANGES ? 'DRAFT' : 'SUBMITTED'),
        },
      });
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: `rfq.review.${input.decision.toLowerCase()}`, entityType: 'Rfq', entityId: rfqId, metadata: { reason: input.reason ?? null } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: `ir.vazano.rfq.reviewed.v1`, payload: { rfqId, decision: input.decision } } });
      return result;
    });
  }

  async publish(user: AuthenticatedUser, rfqId: string) {
    if (!user.permissions.includes('rfq.review')) throw new ForbiddenException('مجوز انتشار استعلام را ندارید.');
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId }, include: { items: true } });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    if (!canPublishRfq(rfq.approvalStatus, rfq.commitmentStatus)) throw new ConflictException('گیت تأیید یا تعهد مالی هنوز تکمیل نشده است.');
    if (rfq.lifecycleState === 'PUBLISHED') return rfq;
    const categoryIds = [...new Set(rfq.items.map((item) => item.categoryId))];
    const now = new Date();
    const suppliers = await this.prisma.supplierProfile.findMany({
      where: {
        verificationStatus: 'VERIFIED',
        organization: {
          status: 'ACTIVE',
          subscriptions: { some: { status: 'ACTIVE', startsAt: { lte: now }, expiresAt: { gt: now } } },
        },
        categories: { some: { categoryId: { in: categoryIds } } },
        ...(rfq.deliveryProvince
          ? { OR: [{ nationwideCoverage: true }, { serviceProvinces: { has: rfq.deliveryProvince } }] }
          : {}),
      },
      include: { categories: { where: { categoryId: { in: categoryIds } }, select: { categoryId: true } } },
    });
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.rfq.update({ where: { id: rfqId }, data: { lifecycleState: 'PUBLISHED', operationalStatus: 'OPEN_FOR_QUOTES', publishedAt: new Date() } });
      for (const supplier of suppliers) {
        await tx.rfqInvitation.upsert({
          where: { rfqId_supplierOrganizationId: { rfqId, supplierOrganizationId: supplier.organizationId } },
          create: {
            rfqId,
            supplierOrganizationId: supplier.organizationId,
            matchReasons: {
              strategy: 'RULE_BASED_V1',
              categoryIds: supplier.categories.map((item) => item.categoryId),
              geography: supplier.nationwideCoverage ? 'NATIONWIDE' : rfq.deliveryProvince ?? 'UNSPECIFIED',
            },
          },
          update: {},
        });
      }
      await tx.auditLog.create({ data: { actorUserId: user.id, organizationId: rfq.buyerOrganizationId, action: 'rfq.publish', entityType: 'Rfq', entityId: rfqId } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: 'ir.vazano.rfq.published.v1', payload: { rfqId } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: rfqId, eventType: 'ir.vazano.rfq.distributed.v1', payload: { rfqId, invitedSupplierCount: suppliers.length, strategy: 'RULE_BASED_V1' } } });
      return { ...result, invitedSupplierCount: suppliers.length };
    });
  }

  async createCommitmentPayment(user: AuthenticatedUser, rfqId: string, idempotencyKey: string) {
    const rfq = await this.findAuthorizedRfq(user, rfqId);
    if (rfq.approvalStatus !== 'APPROVED' || rfq.commitmentStatus !== 'REQUIRED' || !rfq.commitmentAmountRial) {
      throw new ConflictException('این استعلام اکنون نیازمند ایجاد پرداخت تعهد نیست.');
    }
    const existing = await this.prisma.paymentIntent.findUnique({ where: { idempotencyKey } });
    if (existing && (existing.purpose !== 'BUYER_COMMITMENT' || existing.referenceId !== rfq.id || existing.amountRial !== rfq.commitmentAmountRial)) {
      throw new ConflictException('کلید تکرارپذیری برای درخواست دیگری استفاده شده است.');
    }
    if (existing?.authority && ['REDIRECT_PENDING', 'VERIFY_PENDING', 'SUCCEEDED'].includes(existing.status)) {
      const sandbox = this.config.get<string>('ZARINPAL_SANDBOX') !== 'false';
      const startPayUrl = this.config.get<string>('ZARINPAL_START_PAY_URL') ?? (sandbox ? 'https://sandbox.zarinpal.com/pg/StartPay/' : 'https://www.zarinpal.com/pg/StartPay/');
      return { paymentIntentId: existing.id, authority: existing.authority, redirectUrl: `${startPayUrl}${existing.authority}` };
    }
    const intent = existing ?? await this.prisma.paymentIntent.create({
      data: { provider: 'ZARINPAL', purpose: 'BUYER_COMMITMENT', amountRial: rfq.commitmentAmountRial, payerOrganizationId: rfq.buyerOrganizationId, referenceType: 'Rfq', referenceId: rfq.id, idempotencyKey },
    });
    const publicApiUrl = this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3001';
    try {
      const result = await this.payments.create({ amountRial: intent.amountRial, description: `سپرده تعهد استعلام ${rfq.code}`, callbackUrl: `${publicApiUrl}/v1/rfqs/commitments/zarinpal/callback`, mobile: user.mobile, orderId: intent.id });
      await this.prisma.$transaction([
        this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { authority: result.authority, status: 'REDIRECT_PENDING' } }),
        this.prisma.rfq.update({ where: { id: rfq.id }, data: { commitmentStatus: 'PAYMENT_PENDING' } }),
      ]);
      return { paymentIntentId: intent.id, ...result };
    } catch (error) {
      await this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED' } });
      throw error;
    }
  }

  async handleCommitmentCallback(authority: string, callbackStatus: string) {
    const intent = await this.prisma.paymentIntent.findFirst({ where: { authority, provider: 'ZARINPAL', purpose: 'BUYER_COMMITMENT' } });
    if (!intent) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (intent.status === 'SUCCEEDED') return { success: true, alreadyVerified: true, referenceId: intent.providerReference };
    if (callbackStatus !== 'OK') {
      await this.prisma.$transaction([
        this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'CANCELLED', callbackPayload: { status: callbackStatus } } }),
        this.prisma.rfq.update({ where: { id: intent.referenceId }, data: { commitmentStatus: 'REQUIRED' } }),
      ]);
      return { success: false, cancelled: true };
    }
    const verification = await this.payments.verify({ amountRial: intent.amountRial, authority });
    if (!verification.success) {
      await this.prisma.$transaction([
        this.prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: 'FAILED', callbackPayload: { status: callbackStatus, code: verification.code } } }),
        this.prisma.rfq.update({ where: { id: intent.referenceId }, data: { commitmentStatus: 'REQUIRED' } }),
      ]);
      return verification;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({ where: { id: intent.id }, data: { status: 'SUCCEEDED', providerReference: verification.referenceId, verifiedAt: new Date(), callbackPayload: { status: callbackStatus, code: verification.code } } });
      await tx.rfq.update({ where: { id: intent.referenceId }, data: { commitmentStatus: 'HELD', operationalStatus: 'READY_TO_PUBLISH' } });
      await tx.auditLog.create({ data: { organizationId: intent.payerOrganizationId, action: 'rfq.commitment.held', entityType: 'Rfq', entityId: intent.referenceId, metadata: { paymentIntentId: intent.id, providerReference: verification.referenceId } } });
      await tx.outboxEvent.create({ data: { aggregateType: 'Rfq', aggregateId: intent.referenceId, eventType: 'ir.vazano.buyer.commitment.held.v1', payload: { rfqId: intent.referenceId, paymentIntentId: intent.id } } });
    });
    return verification;
  }

  private async create(user: AuthenticatedUser, input: CreateRfqDto, source: RfqSource) {
    const organization = await this.prisma.organization.findUnique({ where: { id: input.buyerOrganizationId } });
    if (!organization || organization.kind !== 'BUYER') throw new NotFoundException('سازمان خریدار پیدا نشد.');

    const buyerContactUserId = source === RfqSource.PLATFORM_OPERATOR ? input.buyerContactUserId! : user.id;
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId: input.buyerOrganizationId, userId: buyerContactUserId, status: 'ACTIVE', role: { in: ['BUYER_OWNER', 'BUYER_MEMBER'] } },
    });
    if (!membership) throw new ForbiddenException('کاربر خریدار عضو فعال این سازمان نیست.');
    if (source === RfqSource.BUYER_SELF_SERVICE && buyerContactUserId !== user.id) {
      throw new ForbiddenException('ثبت استعلام فقط برای سازمان خودتان مجاز است.');
    }

    const domain = await this.prisma.industry.findFirst({ where: { id: input.primaryDomainId, isActive: true } });
    if (!domain) throw new BadRequestException('حوزه اصلی معتبر نیست.');
    await this.validateItems(input.primaryDomainId, input);
    const deliveryLocation = await this.resolveDeliveryLocation(input);

    const responseDeadline = input.responseDeadline ? new Date(input.responseDeadline) : undefined;
    if (responseDeadline && responseDeadline <= new Date()) throw new BadRequestException('مهلت پاسخ باید در آینده باشد.');

    const previousPublishedCount = await this.prisma.rfq.count({
      where: { buyerOrganizationId: input.buyerOrganizationId, lifecycleState: { in: ['PUBLISHED', 'CLOSED'] } },
    });
    const commitmentRequired = previousPublishedCount === 0;
    const code = `VZ-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const rfq = await tx.rfq.create({
        data: {
          code,
          buyerOrganizationId: input.buyerOrganizationId,
          buyerContactUserId,
          createdByUserId: user.id,
          operatorUserId: source === RfqSource.PLATFORM_OPERATOR ? user.id : null,
          primaryDomainId: input.primaryDomainId,
          title: input.title,
          description: input.description,
          entryMethod: input.entryMethod ?? 'STANDARD',
          source,
          manualReviewRequired: true,
          commitmentStatus: commitmentRequired ? 'REQUIRED' : 'NOT_REQUIRED',
          commitmentAmountRial: commitmentRequired ? BUYER_COMMITMENT_AMOUNT_RIAL : null,
          commitmentPolicyVersion: commitmentRequired ? BUYER_COMMITMENT_POLICY_VERSION : null,
          deliveryProvinceId: deliveryLocation.provinceId,
          deliveryCityId: deliveryLocation.cityId,
          deliveryProvince: deliveryLocation.provinceName,
          deliveryCity: deliveryLocation.cityName,
          requiredAt: input.requiredAt ? new Date(input.requiredAt) : undefined,
          responseDeadline,
          installationRequired: input.installationRequired ?? false,
          qualityControlRequested: input.qualityControlRequested ?? false,
          qualityControlFeeBps: input.qualityControlRequested ? QUALITY_CONTROL_FEE_BPS : null,
          displayPricesTaxInclusive: false,
          items: {
            create: input.items.map((item, index) => ({
              categoryId: item.categoryId,
              unitId: item.unitId,
              title: item.title,
              quantity: new Prisma.Decimal(item.quantity),
              specifications: item.specifications ?? {},
              estimatedLineValueRial: item.estimatedLineValueRial ? BigInt(item.estimatedLineValueRial) : null,
              sortOrder: index,
            })),
          },
          qualityControlRequest: input.qualityControlRequested ? { create: { feeBps: QUALITY_CONTROL_FEE_BPS } } : undefined,
        },
        include: { items: true, qualityControlRequest: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: input.buyerOrganizationId,
          action: source === RfqSource.PLATFORM_OPERATOR ? 'rfq.create_on_behalf' : 'rfq.create',
          entityType: 'Rfq',
          entityId: rfq.id,
          metadata: { source, buyerContactUserId, manualReviewRequired: true },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Rfq',
          aggregateId: rfq.id,
          eventType: 'ir.vazano.rfq.draft.created.v1',
          payload: { rfqId: rfq.id, source, buyerOrganizationId: input.buyerOrganizationId },
        },
      });
      return rfq;
    });
  }

  private async resolveDeliveryLocation(input: CreateRfqDto) {
    const provinceName = input.deliveryProvince?.trim();
    const provinceRequested = input.deliveryProvinceId || provinceName;
    const cityRequested = input.deliveryCityId || input.deliveryCity?.trim();
    if (!provinceRequested && !cityRequested) return { provinceId: undefined, cityId: undefined, provinceName: undefined, cityName: undefined };
    if (!provinceRequested) throw new BadRequestException('برای انتخاب شهر، استان تحویل را نیز مشخص کنید.');

    const province = await this.prisma.province.findFirst({
      where: input.deliveryProvinceId ? { id: input.deliveryProvinceId, isActive: true } : { nameFa: provinceName, isActive: true },
    });
    if (!province) throw new BadRequestException('استان تحویل معتبر یا فعال نیست.');
    if (!cityRequested) return { provinceId: province.id, cityId: undefined, provinceName: province.nameFa, cityName: undefined };

    const cityName = input.deliveryCity?.trim();
    const city = await this.prisma.city.findFirst({
      where: input.deliveryCityId
        ? { id: input.deliveryCityId, provinceId: province.id, isActive: true }
        : { nameFa: cityName, provinceId: province.id, isActive: true },
    });
    if (!city) throw new BadRequestException('شهر تحویل با استان انتخاب‌شده مطابقت ندارد یا غیرفعال است.');
    return { provinceId: province.id, cityId: city.id, provinceName: province.nameFa, cityName: city.nameFa };
  }

  private async validateItems(primaryDomainId: string, input: CreateRfqDto): Promise<void> {
    const categoryIds = [...new Set(input.items.map((item) => item.categoryId))];
    const unitIds = [...new Set(input.items.map((item) => item.unitId))];
    const [categories, units, attributeBindings] = await Promise.all([
      this.prisma.category.count({ where: { id: { in: categoryIds }, industryId: primaryDomainId, isActive: true } }),
      this.prisma.unitOfMeasure.count({ where: { id: { in: unitIds }, isActive: true } }),
      this.prisma.categoryAttribute.findMany({
        where: { categoryId: { in: categoryIds }, attribute: { isActive: true } },
        include: { attribute: true },
      }),
    ]);
    if (categories !== categoryIds.length) throw new BadRequestException('یک یا چند دسته‌بندی نامعتبر است.');
    if (units !== unitIds.length) throw new BadRequestException('یک یا چند واحد اندازه‌گیری نامعتبر است.');

    for (const item of input.items) {
      const bindings = attributeBindings.filter((binding) => binding.categoryId === item.categoryId);
      const bindingByCode = new Map(bindings.map((binding) => [binding.attribute.code, binding]));
      const specifications = item.specifications ?? {};
      const isPresent = (value: string | number | boolean | string[] | null | undefined) =>
        value !== null && value !== undefined && (typeof value !== 'string' || value.trim().length > 0) && (!Array.isArray(value) || value.length > 0);

      for (const binding of bindings) {
        if (binding.isRequired && !isPresent(specifications[binding.attribute.code])) {
          throw new BadRequestException(`ویژگی «${binding.attribute.nameFa}» برای این محصول الزامی است.`);
        }
      }

      for (const [code, value] of Object.entries(specifications)) {
        const binding = bindingByCode.get(code);
        if (!binding) throw new BadRequestException(`ویژگی فنی «${code}» برای دسته انتخاب‌شده معتبر نیست.`);
        if (!isPresent(value)) continue;

        const options = Array.isArray(binding.attribute.options)
          ? binding.attribute.options.filter((option): option is string => typeof option === 'string')
          : [];
        const validation = typeof binding.attribute.validation === 'object' && binding.attribute.validation !== null && !Array.isArray(binding.attribute.validation)
          ? binding.attribute.validation
          : {};

        if (binding.attribute.dataType === 'TEXT') {
          if (typeof value !== 'string') throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید متن باشد.`);
          const maxLength = typeof validation.maxLength === 'number' ? validation.maxLength : undefined;
          if (maxLength && value.length > maxLength) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» بیش از حد طولانی است.`);
        }
        if (binding.attribute.dataType === 'NUMBER') {
          const numericValue = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : Number.NaN);
          if (!Number.isFinite(numericValue)) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید عدد باشد.`);
          const minimum = typeof validation.min === 'number' ? validation.min : undefined;
          const maximum = typeof validation.max === 'number' ? validation.max : undefined;
          if (minimum !== undefined && numericValue < minimum) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» کمتر از حد مجاز است.`);
          if (maximum !== undefined && numericValue > maximum) throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» بیشتر از حد مجاز است.`);
        }
        if (binding.attribute.dataType === 'SINGLE_SELECT' && (typeof value !== 'string' || !options.includes(value))) {
          throw new BadRequestException(`گزینه انتخاب‌شده برای «${binding.attribute.nameFa}» معتبر نیست.`);
        }
        if (binding.attribute.dataType === 'MULTI_SELECT' && (!Array.isArray(value) || value.some((selected) => !options.includes(selected)))) {
          throw new BadRequestException(`گزینه‌های انتخاب‌شده برای «${binding.attribute.nameFa}» معتبر نیست.`);
        }
        if (binding.attribute.dataType === 'BOOLEAN' && typeof value !== 'boolean') {
          throw new BadRequestException(`مقدار «${binding.attribute.nameFa}» باید بله یا خیر باشد.`);
        }
      }
    }
  }

  private async findAuthorizedRfq(user: AuthenticatedUser, rfqId: string) {
    const rfq = await this.prisma.rfq.findUnique({ where: { id: rfqId }, include: { items: true } });
    if (!rfq) throw new NotFoundException('استعلام پیدا نشد.');
    const isMember = user.memberships.some((membership) => membership.organizationId === rfq.buyerOrganizationId);
    const isOperator = user.permissions.includes('rfq.create_on_behalf') || user.permissions.includes('rfq.manage');
    if (!isMember && !isOperator) throw new ForbiddenException('دسترسی به این استعلام مجاز نیست.');
    return rfq;
  }
}
