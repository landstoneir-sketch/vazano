import { OrganizationPanel } from './organization-panel';
import { safeReturnTo } from '@/lib/route-access';

export const metadata = { title: 'حساب سازمانی' };
export default async function OrganizationPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  return <section className="container dashboard"><h1>حساب سازمانی</h1><OrganizationPanel returnTo={params.returnTo ? safeReturnTo(params.returnTo) : undefined} /></section>;
}
