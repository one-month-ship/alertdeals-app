import {
  AD_OWNER_TYPE_VALUES,
  ENABLED_AD_SOURCE_VALUES,
  ALERT_MODE_VALUES,
  EAlertMode,
} from '@alertdeals/shared';
import { z } from 'zod';

const currentYear = new Date().getFullYear();

const emptyToNull = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : v;

const optionalNumber = (schema: z.ZodTypeAny) =>
  z.preprocess(emptyToNull, schema.nullable());

// Champ numérique obligatoire : accepte les mêmes entrées qu'`optionalNumber`
// ('' devient null) mais rejette null avec un message dédié, pour que le form
// affiche "requis" plutôt qu'une erreur de coercion générique.
const requiredNumber = (schema: z.ZodTypeAny, message: string) =>
  z.preprocess(emptyToNull, schema.nullable().refine((v) => v !== null, { message }));

const notificationChannelsSchema = z.object({
  email: z.boolean(),
  phone: z.boolean(),
  whatsapp: z.boolean(),
});

export const alertFormSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom de l'alerte est requis").max(255),

    // Listing platforms this alert matches ads from
    sources: z
      .array(z.enum(ENABLED_AD_SOURCE_VALUES))
      .min(1, 'Sélectionnez au moins une plateforme'),

    brandIds: z.array(z.number().int().positive()).default([]),
    modelIds: z.array(z.number().int().positive()).default([]),
    locationId: requiredNumber(
      z.coerce.number().int().positive(),
      'La localisation est requise',
    ),
    radiusInKm: requiredNumber(
      z.coerce.number().int().min(0).max(200),
      'Le périmètre est requis',
    ),
    modelYearMin: optionalNumber(
      z.coerce
        .number()
        .int()
        .min(1900)
        .max(currentYear + 1),
    ),
    modelYearMax: optionalNumber(
      z.coerce
        .number()
        .int()
        .min(1900)
        .max(currentYear + 1),
    ),
    mileageMin: optionalNumber(z.coerce.number().int().min(0)),
    mileageMax: optionalNumber(z.coerce.number().int().min(0)),
    priceMin: optionalNumber(z.coerce.number().min(0)),

    mode: z.enum(ALERT_MODE_VALUES),
    priceMax: optionalNumber(z.coerce.number().positive()),
    marginMinPercentage: optionalNumber(z.coerce.number().positive().max(100)),
    excludeDamaged: z.boolean().default(true),
    // Typologie d'offre ciblée : null = particuliers et professionnels
    ownerType: z.preprocess(emptyToNull, z.enum(AD_OWNER_TYPE_VALUES).nullable()),

    notificationChannels: notificationChannelsSchema,
  })
  .refine((data) => !(data.modelIds.length > 0 && data.brandIds.length === 0), {
    message: 'Vous devez sélectionner une marque avant de choisir un modèle',
    path: ['modelIds'],
  })
  .refine(
    (data) =>
      !(
        data.modelYearMin != null &&
        data.modelYearMax != null &&
        data.modelYearMin > data.modelYearMax
      ),
    {
      message: "L'année min doit être inférieure ou égale à l'année max",
      path: ['modelYearMin'],
    },
  )
  .refine(
    (data) =>
      !(
        data.mileageMin != null &&
        data.mileageMax != null &&
        data.mileageMin > data.mileageMax
      ),
    {
      message: 'Le kilométrage min doit être inférieur ou égal au max',
      path: ['mileageMin'],
    },
  )
  .refine(
    (data) =>
      data.mode !== EAlertMode.PRICE_MAX || (data.priceMax != null && data.priceMax > 0),
    {
      message: "Renseignez un prix déclencheur d'alerte",
      path: ['priceMax'],
    },
  )
  .refine(
    (data) =>
      data.mode !== EAlertMode.MARGIN_MIN ||
      (data.marginMinPercentage != null && data.marginMinPercentage > 0),
    {
      message: 'Renseignez une marge minimum',
      path: ['marginMinPercentage'],
    },
  )
  .refine(
    (data) =>
      data.notificationChannels.email ||
      data.notificationChannels.phone ||
      data.notificationChannels.whatsapp,
    {
      message: 'Au moins un canal de notification doit être activé',
      path: ['notificationChannels'],
    },
  );

export type TAlertFormData = z.infer<typeof alertFormSchema>;

export const createAlertSchema = alertFormSchema;
export type TCreateAlertData = z.infer<typeof createAlertSchema>;
