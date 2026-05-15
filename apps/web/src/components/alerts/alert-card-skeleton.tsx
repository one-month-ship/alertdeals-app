import { Skeleton } from '@/components/ui/skeleton';

export type TAlertCardSkeletonProps = {
  count?: number;
};

export function AlertCardSkeleton({ count = 1 }: TAlertCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-white/10 bg-white/5 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  );
}
