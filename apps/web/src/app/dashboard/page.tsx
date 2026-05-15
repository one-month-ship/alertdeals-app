import { pages } from '@/config/routes';
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  redirect(pages.hotDeals);
}
