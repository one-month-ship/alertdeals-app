import { Toaster } from '@/components/ui/sonner';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlertDeals',
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="fr">
    <body>
      {children}
      <Toaster position="top-right" richColors />
    </body>
  </html>
);

export default RootLayout;
