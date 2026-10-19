import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';

export type AuthenticatedRequest = Request & { user: AuthenticatedUser; sessionToken: string };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readToken(request);
    if (!token) throw new UnauthorizedException('برای ادامه وارد حساب شوید.');
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.auth.hashToken(token) },
      include: {
        user: {
          include: {
            memberships: { where: { status: 'ACTIVE' }, select: { organizationId: true, role: true } },
            userRoles: {
              where: { organizationId: null },
              include: { role: { include: { permissions: { include: { permission: true } } } } },
            },
          },
        },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new UnauthorizedException('نشست شما معتبر نیست.');
    const permissions = new Set<string>();
    for (const userRole of session.user.userRoles) for (const item of userRole.role.permissions) permissions.add(item.permission.key);
    request.user = {
      id: session.user.id,
      mobile: session.user.mobile,
      status: session.user.status,
      permissions: [...permissions],
      globalRoles: session.user.userRoles.map((item) => item.role.key),
      memberships: session.user.memberships,
    };
    request.sessionToken = token;
    await this.prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return true;
  }

  private readToken(request: Request): string | undefined {
    const cookie = (request.cookies as Record<string, string> | undefined)?.vazano_session;
    if (cookie) return cookie;
    const authorization = request.headers.authorization;
    return authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  }
}
