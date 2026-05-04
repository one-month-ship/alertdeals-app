import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Connexion · AlertDeals',
  description: 'Connecte-toi à ton compte AlertDeals',
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
