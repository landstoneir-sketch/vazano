import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { MemberRole, OrganizationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateOrganizationDto } from './create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}
  listForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId, status: 'ACTIVE' } } },
      include: { members: { where: { userId }, select: { role: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, input: CreateOrganizationDto) {
    if (input.kind === OrganizationKind.PLATFORM) throw new BadRequestException('ایجاد سازمان پلتفرم از این مسیر مجاز نیست.');
    const ownerRole = input.kind === OrganizationKind.BUYER ? MemberRole.BUYER_OWNER : MemberRole.SUPPLIER_OWNER;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({ data: { ...input, status: input.kind === OrganizationKind.BUYER ? 'ACTIVE' : 'PENDING' } });
        await tx.organizationMember.create({ data: { organizationId: organization.id, userId, role: ownerRole } });
        await tx.auditLog.create({ data: { actorUserId: userId, organizationId: organization.id, action: 'organization.create', entityType: 'Organization', entityId: organization.id } });
        await tx.outboxEvent.create({ data: { aggregateType: 'Organization', aggregateId: organization.id, eventType: 'ir.vazano.organization.created.v1', payload: { organizationId: organization.id, kind: organization.kind } } });
        return organization;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('شناسه ملی قبلاً ثبت شده است.');
      throw error;
    }
  }
}
