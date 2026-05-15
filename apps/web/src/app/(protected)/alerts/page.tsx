import { AlertsView } from '@/components/alerts/alerts-view';
import { getAccountAlerts } from '@/services/alert.service';

export default async function AlertsPage() {
  const alerts = await getAccountAlerts();
  return <AlertsView alerts={alerts} />;
}
