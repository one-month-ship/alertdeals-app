'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bell, BellRing, CreditCard, Flame, LogOut, Menu, User, X } from 'lucide-react';
import { pages } from '@/config/routes';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Hot Deals', href: pages.hotDeals, icon: Flame },
  { label: 'Alertes', href: pages.alerts.list, icon: Bell },
  { label: 'Abonnement', href: pages.subscription, icon: CreditCard },
  { label: 'Mon compte', href: pages.account, icon: User },
] as const;

export const Sidebar = () => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Mobile top bar */}
      <header className="relative z-20 flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href={pages.hotDeals} className="flex items-center gap-2.5">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <BellRing className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">AlertDeals</span>
        </Link>
        <button
          type="button"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-white transition-colors hover:bg-white/10"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      {/* Sidebar (desktop fixed, mobile drawer) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-white/5 backdrop-blur-xl transition-transform md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand (desktop) */}
          <Link
            href={pages.hotDeals}
            className="hidden items-center gap-3 border-b border-white/10 px-6 py-5 md:flex"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
              <BellRing className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">AlertDeals</span>
          </Link>

          {/* Nav items */}
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    active
                      ? 'bg-linear-to-r from-indigo-500/90 to-fuchsia-500/80 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Sign out */}
          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => {
                // TODO: wire to signOut server action once auth branch is merged
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition-all hover:bg-white/5 hover:text-white"
            >
              <LogOut size={18} className="text-slate-400" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
};
