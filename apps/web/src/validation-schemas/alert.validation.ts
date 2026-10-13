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

    // Optionnels ici : l'obligation dépend du mode (voir le refine PRICE_MAX
    // plus bas). En mode marge, le revendeur se moque du modèle : la marge est
    // calculée par rapport au marché, quel que soit le véhicule.
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
  // Un prix max n'a de sens que pour un modèle précis : fixer "10 000 €" veut
  // dire qu'on sait ce que vaut le véhicule. Sans modèle, c'est "tous les
  // véhicules sous X €" : pas une bonne affaire, juste un flux Leboncoin qui
  // matche tout et brûle du quota Lobstr pour rien.
  .refine((data) => data.mode !== EAlertMode.PRICE_MAX || data.brandIds.length > 0, {
    message: 'Un prix max suppose de savoir ce que vaut le véhicule : sélectionnez une marque',
    path: ['brandIds'],
  })
  .refine((data) => data.mode !== EAlertMode.PRICE_MAX || data.modelIds.length > 0, {
    message:
      'Un prix max suppose de savoir ce que vaut le véhicule : sélectionnez au moins un modèle',
    path: ['modelIds'],
  })
  .refine(
    (data) =>
      !(
        data.mode === EAlertMode.PRICE_MAX &&
        data.priceMin != null &&
        data.priceMax != null &&
        data.priceMin >= data.priceMax
      ),
    {
      message: "Le prix minimum doit être strictement inférieur au prix déclencheur d'alerte",
      path: ['priceMin'],
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
