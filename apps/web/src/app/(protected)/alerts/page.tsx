import { AlertsView } from '@/components/alerts/alerts-view';
import { pages } from '@/config/routes';
import { createClient } from '@/lib/supabase/server';
import { getAccountAlerts } from '@/services/alert.service';
import { redirect } from 'next/navigation';

export default async function AlertsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(pages.login);

  const alerts = await getAccountAlerts();
  return <AlertsView alerts={alerts} />;
}
