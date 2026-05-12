import { ALERT_MODE_VALUES, EAlertMode } from '@alertdeals/shared';
import { z } from 'zod';

const currentYear = new Date().getFullYear();

const emptyToNull = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : v;

const optionalNumber = (schema: z.ZodTypeAny) =>
  z.preprocess(emptyToNull, schema.nullable());

const notificationChannelsSchema = z.object({
  email: z.boolean(),
  phone: z.boolean(),
  whatsapp: z.boolean(),
});

export const alertFormSchema = z
  .object({
    name: z.preprocess(emptyToNull, z.string().trim().max(255).nullable()),

    brandId: optionalNumber(z.coerce.number().int().positive()),
    modelId: optionalNumber(z.coerce.number().int().positive()),
    locationId: optionalNumber(z.coerce.number().int().positive()),
    radiusInKm: optionalNumber(z.coerce.number().int().min(0).max(200)),
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

    notificationChannels: notificationChannelsSchema,
  })
  .refine((data) => !(data.modelId != null && data.brandId == null), {
    message: 'Vous devez sélectionner une marque avant de choisir un modèle',
    path: ['modelId'],
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
