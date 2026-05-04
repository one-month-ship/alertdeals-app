'use client';

import { signInWithGoogle, signInWithMagicLink } from '@/actions/auth.actions';
import { magicLinkSchema, type TMagicLinkFormData } from '@/validation-schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { BellRing } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

export function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');
  const [error, setError] = useState<string | null>(urlError);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TMagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: TMagicLinkFormData) => {
    setError(null);
    setIsSuccess(false);
    const result = await signInWithMagicLink(data);
    if (result.error) {
      setError(result.error);
      return;
    }
    setIsSuccess(true);
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsSuccess(false);
    const result = await signInWithGoogle();
    if (result?.error) setError(result.error);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-12">
      {/* Decorative blurred orbs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/30">
            <BellRing className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">AlertDeals</h1>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h2 className="mb-1 text-lg font-semibold text-white">Connexion</h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              Lien envoyé ! Vérifie ta boîte de réception.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-200">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-slate-500 focus:border-indigo-400 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                placeholder="ton.email@gmail.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-sm text-red-400">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-2.5 font-medium text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-400 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Envoi en cours…' : 'Recevoir le lien magique'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wider text-slate-500">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 py-2.5 font-medium text-slate-200 transition hover:bg-white/10"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuer avec Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          En te connectant, tu acceptes nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
}
