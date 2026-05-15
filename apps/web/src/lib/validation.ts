import { z } from 'zod';

export function formatZodError(error: z.ZodError): string {
  const fieldErrors = error.flatten().fieldErrors;
  const firstError = Object.values(fieldErrors).flat()[0] as string | undefined;
  return firstError ?? 'Données de formulaire invalides';
}
