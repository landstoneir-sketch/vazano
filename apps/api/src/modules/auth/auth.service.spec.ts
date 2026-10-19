import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from './auth.service';
import type { SmsPort } from './sms/sms.port';

function createService(prisma: PrismaService): AuthService {
  const sms: SmsPort = { sendOtp: jest.fn(), sendTemplate: jest.fn() };
  return new AuthService(prisma, new ConfigService({ OTP_PEPPER: 'test-only-otp-pepper-with-32-characters' }), sms);
}

describe('AuthService session management', () => {
  it('lists only active sessions owned by the user and never returns token digests', async () => {
    const rawToken = 'current-session-token';
    const sessionFindMany = jest.fn().mockResolvedValue([
      {
        id: 'session-current', tokenHash: createService({} as PrismaService).hashToken(rawToken),
        expiresAt: new Date('2030-01-01'), lastSeenAt: new Date('2026-01-02'), createdAt: new Date('2026-01-01'),
        ipAddress: '127.0.0.1', userAgent: 'Browser A',
      },
      {
        id: 'session-other', tokenHash: 'another-digest',
        expiresAt: new Date('2030-01-01'), lastSeenAt: new Date('2026-01-01'), createdAt: new Date('2025-12-01'),
        ipAddress: null, userAgent: 'Browser B',
      },
    ]);
    const prisma = { session: { findMany: sessionFindMany } } as unknown as PrismaService;

    const result = await createService(prisma).listSessions('user-1', rawToken);

    expect(sessionFindMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({ id: 'session-current', isCurrent: true }),
      expect.objectContaining({ id: 'session-other', isCurrent: false }),
    ]);
    expect(result.some((session) => 'tokenHash' in session)).toBe(false);
  });

  it('does not allow revoking a session outside the authenticated user', async () => {
    const sessionFindFirst = jest.fn().mockResolvedValue(null);
    const prisma = { session: { findFirst: sessionFindFirst } } as unknown as PrismaService;

    await expect(createService(prisma).revokeSession('user-1', 'foreign-session', 'token')).rejects.toBeInstanceOf(NotFoundException);
    expect(sessionFindFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-session', userId: 'user-1', revokedAt: null },
      select: { id: true, tokenHash: true },
    });
  });
});
