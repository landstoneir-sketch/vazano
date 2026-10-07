import { SupportTicketDetail } from './support-ticket-detail';

export const metadata = { title: 'پیگیری درخواست پشتیبانی' };

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <section className="container dashboard"><SupportTicketDetail ticketId={id} /></section>;
}
