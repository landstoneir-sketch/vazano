import type { ExecutionContext } from '@nestjs/common';
import { SessionGuard } from './session.guard';

describe('SessionGuard role isolation', () => {
  it('loads permissions only from global roles', async () => {
    const request = { cookies: { vazano_session: 'session-token' }, headers: {} } as Record<string, unknown>;
    const session = {
      id: 'session-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: 'user-1', mobile: '09120000000', status: 'ACTIVE', memberships: [],
        userRoles: [{ organizationId: null, role: { key: 'SUPPORT', permissions: [{ permission: { key: 'support.manage' } }] } }],
      },
    };
    let findInput: unknown;
    const prisma = {
      session: {
        findUnique: jest.fn((input: unknown) => { findInput = input; return Promise.resolve(session); }),
        update: jest.fn().mockResolvedValue(session),
      },
    };
    const auth = { hashToken: jest.fn().mockReturnValue('hashed-token') };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new SessionGuard(prisma as never, auth as never);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(JSON.stringify(findInput)).toContain('"userRoles":{"where":{"organizationId":null}');
    expect(request.user).toMatchObject({ permissions: ['support.manage'], globalRoles: ['SUPPORT'] });
  });
});
