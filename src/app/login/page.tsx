import type { Metadata } from 'next';
import { safeReturnTo } from '@/lib/route-access';
import { LoginForm } from './login-form';
export const metadata: Metadata = { title: 'ورود' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  return <section className="auth-shell"><LoginForm returnTo={safeReturnTo(params.returnTo)} /></section>;
}
