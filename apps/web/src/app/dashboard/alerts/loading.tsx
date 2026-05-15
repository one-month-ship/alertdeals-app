import { AlertCardSkeleton } from '@/components/alerts/alert-card-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function AlertsLoading() {
  return (
    <div className="px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AlertCardSkeleton count={6} />
      </div>
    </div>
  );
}
