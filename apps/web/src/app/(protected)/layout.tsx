import type { ReactNode } from 'react';
import { Sidebar } from './_components/sidebar';

const ProtectedLayout = ({ children }: { children: ReactNode }) => (
  <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900">
    {/* Decorative blurred orbs */}
    <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
    <div className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />

    <Sidebar />

    <main className="relative md:pl-64">
      <div className="mx-auto max-w-5xl px-6 py-8 text-slate-100">{children}</div>
    </main>
  </div>
);

export default ProtectedLayout;
