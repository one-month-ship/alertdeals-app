import { Skeleton } from '@/components/ui/skeleton';

export function AlertFormSkeleton() {
  return (
    <div className="space-y-6 rounded-lg border border-white/10 p-6">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
      <div className="flex justify-end">
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}
