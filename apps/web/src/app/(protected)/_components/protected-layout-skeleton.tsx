import { Skeleton } from '@/components/ui/skeleton';
import type { ReactNode } from 'react';

type Props = { children: ReactNode };

export function ProtectedLayoutSkeleton({ children }: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900">
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-white/5 backdrop-blur-xl md:block">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
            <Skeleton className="h-10 w-10 rounded-2xl" />
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="flex-1 space-y-2 p-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="border-t border-white/10 p-3">
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </aside>

      <main className="relative md:pl-64">
        <div className="mx-auto max-w-5xl px-6 py-8 text-slate-100">{children}</div>
      </main>
    </div>
  );
}
