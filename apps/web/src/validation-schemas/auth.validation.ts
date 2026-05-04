import { z } from 'zod';

export const magicLinkSchema = z.object({
  email: z
    .string()
    .min(1, "L'email doit être renseigné")
    .email("L'email ne semble pas valide"),
});

export type TMagicLinkFormData = z.infer<typeof magicLinkSchema>;
