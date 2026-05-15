import { AlertFormSkeleton } from '@/components/alerts/alert-form-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditAlertLoading() {
  return (
    <div className="px-4 py-8">
      <Skeleton className="mb-6 h-8 w-56" />
      <AlertFormSkeleton />
    </div>
  );
}
