"use client";

import { createAlert, updateAlert } from "@/actions/alert.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { pages } from "@/config/routes";
import type { TAccountAlert } from "@/services/alert.service";
import { getErrorMessage } from "@/utils/error-messages.utils";
import { alertFormSchema, type TAlertFormData } from "@/validation-schemas";
import type { TBrand, TLocation, TVehicleModel } from "@alertdeals/db";
import {
  ALERT_MODE_DEFINITIONS,
  DEFAULT_ALERT_SOURCES,
  EAlertMode,
  ENABLED_AD_SOURCE_DEFINITIONS,
  ENABLED_AD_SOURCE_VALUES,
  getAdSourceLabel,
  getSourcesMissingFilter,
} from "@alertdeals/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { LocationSearch } from "./location-search";

type Props = {
  brands: TBrand[];
  vehicleModels: TVehicleModel[];
  hasFullAccess: boolean;
  alert?: TAccountAlert;
};

// Empêche la saisie de valeurs négatives ou en notation scientifique dans les inputs numériques
// (montant, kilométrage, années…). On bloque au keydown plutôt qu'au validate pour un retour immédiat.
const blockNegativeKeystroke = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "-" || e.key === "e" || e.key === "E") e.preventDefault();
};

// Liste centralisée des canaux de notification.
// Chaque canal peut porter un `warning` affiché sous la case si elle est cochée
// (ex. tuto d'installation pour les notifs téléphone, rappel de fournir le numéro WhatsApp).
const CHANNEL_OPTIONS: {
  key: "email" | "phone" | "whatsapp";
  label: string;
  warning?: React.ReactNode;
}[] = [
  { key: "email", label: "Email" },
  {
    key: "phone",
    label: "Téléphone",
    warning: (
      <>
        Pour ce mode, tu dois d'abord installer l'application sur ton téléphone.
        Regarde le tuto{" "}
        <a href="#" className="font-medium underline">
          ici
        </a>
        .
      </>
    ),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    warning: (
      <>
        Tu devras nous communiquer le numéro WhatsApp sur lequel t'envoyer les
        alertes. Tu peux le faire{" "}
        <a href="#" className="font-medium underline">
          ici
        </a>
        .
      </>
    ),
  },
];

export function AlertForm({
  brands,
  vehicleModels,
  hasFullAccess,
  alert,
}: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditMode = !!alert;

  // Valeurs initiales du form, dérivées de l'alerte en édition (ou vides en création).
  // Mémoïsées pour servir à la fois de `defaultValues` et au `reset()` ci-dessous.
  const defaultValues = useMemo<TAlertFormData>(
    () => ({
      name: alert?.name ?? "",
      // Platforms disabled since the alert was created are dropped silently
      sources:
        alert?.sources?.filter((source) =>
          ENABLED_AD_SOURCE_VALUES.includes(source),
        ) ?? DEFAULT_ALERT_SOURCES,
      // Multi-select : une alerte peut cibler plusieurs marques et modèles.
      // Les valeurs viennent des tables de jointure `alert_brands` / `alert_models`,
      // on aplatit en simple liste d'IDs côté form.
      brandIds: alert?.brands?.map((b) => b.brandId) ?? [],
      modelIds: alert?.models?.map((m) => m.modelId) ?? [],
      locationId: alert?.locationId ?? null,
      radiusInKm: alert?.radiusInKm ?? null,
      modelYearMin: alert?.modelYearMin ?? null,
      modelYearMax: alert?.modelYearMax ?? null,
      mileageMin: alert?.mileageMin ?? null,
      mileageMax: alert?.mileageMax ?? null,
      priceMin: alert?.priceMin ?? null,
      mode: alert?.mode ?? EAlertMode.PRICE_MAX,
      priceMax: alert?.priceMax ?? null,
      marginMinPercentage: alert?.marginMinPercentage ?? null,
      excludeDamaged: alert?.excludeDamaged ?? true,
      notificationChannels: alert?.notificationChannels ?? {
        email: true,
        phone: false,
        whatsapp: false,
      },
    }),
    [alert],
  );

  const form = useForm<TAlertFormData>({
    resolver: zodResolver(alertFormSchema),
    defaultValues,
  });

  const selectedBrandIds =
    useWatch({ control: form.control, name: "brandIds" }) ?? [];
  const selectedMode = useWatch({ control: form.control, name: "mode" });
  const selectedSources =
    useWatch({ control: form.control, name: "sources" }) ?? [];
  // Margin mode needs a market estimate, which not every platform provides
  const sourcesWithoutMargin =
    selectedMode === EAlertMode.MARGIN_MIN
      ? getSourcesMissingFilter("marginMin", selectedSources)
      : [];
  const excludeDamaged = useWatch({
    control: form.control,
    name: "excludeDamaged",
  });
  // The damage flag is not reported by every platform: their ads pass the filter
  const sourcesWithoutVehicleState = excludeDamaged
    ? getSourcesMissingFilter("vehicleState", selectedSources)
    : [];
  // Local state to display the selected location's name/zipcode in the LocationSearch trigger.
  // The form only stores the locationId, which is what the server action expects.
  const [selectedLocation, setSelectedLocation] = useState<TLocation | null>(
    alert?.location ?? null,
  );

  // Next (cacheComponents) garde les derniers segments visités montés dans un
  // <Activity> caché : quitter /alerts/new puis y revenir ne remonte PAS le
  // composant, donc l'état de useForm survivait à la navigation et l'utilisateur
  // retrouvait les champs de sa saisie précédente. Activity rejoue les effets à
  // chaque réaffichage : on repart des valeurs par défaut à chaque visite.
  useEffect(() => {
    form.reset(defaultValues);
    setSelectedLocation(alert?.location ?? null);
    setSubmitError(null);
  }, [form, defaultValues, alert?.location]);

  const filteredModels = useMemo(() => {
    if (selectedBrandIds.length === 0) return [];
    return vehicleModels.filter((m) => selectedBrandIds.includes(m.brandId));
  }, [selectedBrandIds, vehicleModels]);

  const onSubmit = async (data: TAlertFormData) => {
    setSubmitError(null);
    const result = isEditMode
      ? await updateAlert(alert.id, data)
      : await createAlert(data);
    if ("error" in result) {
      setSubmitError(getErrorMessage(result.error));
      return;
    }
    toast.success(
      isEditMode
        ? "Alerte mise à jour avec succès !"
        : "Alerte créée avec succès !",
    );
    router.push(pages.alerts.list);
  };

  if (!hasFullAccess && !isEditMode) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="text-amber-200">Abonnement requis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-amber-100/80">
          <p className="text-sm">
            La création d'alertes est réservée aux membres abonnés.
          </p>
          <Button asChild>
            <a href={pages.subscription}>S'abonner</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de l'alerte *</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex. Peugeot 208 Île-de-France"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Pour retrouver l'alerte plus facilement.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle>Plateformes</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="sources"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-wrap gap-4">
                      {ENABLED_AD_SOURCE_DEFINITIONS.map((source) => {
                        const values = field.value ?? [];
                        const isSelected = values.includes(source.value);
                        return (
                          <label
                            key={source.value}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                field.onChange(
                                  checked === true
                                    ? [...values, source.value]
                                    : values.filter((v) => v !== source.value),
                                )
                              }
                            />
                            {source.label}
                          </label>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Plateformes sur lesquelles cette alerte surveille les
                    annonces.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critères de recherche</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="brandIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marques</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={brands}
                      selectedIds={field.value ?? []}
                      onChange={(ids) => {
                        field.onChange(ids);
                        // Drop models that no longer match the selected brands.
                        const allowedModelIds = new Set(
                          vehicleModels
                            .filter((m) => ids.includes(m.brandId))
                            .map((m) => m.id),
                        );
                        const currentModelIds =
                          form.getValues("modelIds") ?? [];
                        form.setValue(
                          "modelIds",
                          currentModelIds.filter((id) =>
                            allowedModelIds.has(id),
                          ),
                        );
                      }}
                      placeholder="Toutes les marques"
                      countLabel="marques choisies"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modèles</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={filteredModels}
                      selectedIds={field.value ?? []}
                      onChange={field.onChange}
                      disabled={selectedBrandIds.length === 0}
                      placeholder={
                        selectedBrandIds.length === 0
                          ? "Sélectionnez d'abord une marque"
                          : "Tous les modèles"
                      }
                      countLabel="modèles choisis"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelYearMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Année min</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      onKeyDown={blockNegativeKeystroke}
                      placeholder="2018"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelYearMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Année max</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      onKeyDown={blockNegativeKeystroke}
                      placeholder="2024"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mileageMin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kilométrage min</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      onKeyDown={blockNegativeKeystroke}
                      placeholder="0"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mileageMax"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kilométrage max</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      onKeyDown={blockNegativeKeystroke}
                      placeholder="150000"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Localisation *</FormLabel>
                  <LocationSearch
                    value={selectedLocation}
                    onChange={(location) => {
                      setSelectedLocation(location);
                      field.onChange(location?.id ?? null);
                    }}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="radiusInKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Périmètre (km) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      onKeyDown={blockNegativeKeystroke}
                      placeholder="50"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priceMin"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Prix minimum (EUR)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      onKeyDown={blockNegativeKeystroke}
                      placeholder="3000"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="excludeDamaged"
              render={({ field }) => (
                <FormItem className="space-y-2 md:col-span-2">
                  <div className="flex flex-row items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">
                      Ignorer les véhicules endommagés
                    </FormLabel>
                  </div>
                  <FormDescription className="ml-7">
                    Une épave affichée à bas prix n&apos;est pas une bonne
                    affaire.
                    {sourcesWithoutVehicleState.length > 0 && (
                      <>
                        {" "}
                        <span className="text-amber-600">
                          {sourcesWithoutVehicleState
                            .map(getAdSourceLabel)
                            .join(", ")}{" "}
                          n&apos;indique pas l&apos;état du véhicule : ses
                          annonces ne seront pas filtrées.
                        </span>
                      </>
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prix d'alerte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="space-y-2"
                    >
                      {ALERT_MODE_DEFINITIONS.map((modeDef) => (
                        <label
                          key={modeDef.key}
                          htmlFor={`mode-${modeDef.key}`}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition hover:bg-accent"
                        >
                          <RadioGroupItem
                            id={`mode-${modeDef.key}`}
                            value={modeDef.value}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{modeDef.label}</div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {modeDef.description}
                            </p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedMode === EAlertMode.PRICE_MAX && (
              <FormField
                control={form.control}
                name="priceMax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix déclencheur d'alerte (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        onKeyDown={blockNegativeKeystroke}
                        placeholder="15000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedMode === EAlertMode.MARGIN_MIN && (
              <FormField
                control={form.control}
                name="marginMinPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marge min (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        onKeyDown={blockNegativeKeystroke}
                        placeholder="15"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    {sourcesWithoutMargin.length > 0 && (
                      <FormDescription className="text-amber-600">
                        Actuellement, nous n'offrons pas encore l'alerte de
                        marge pour{" "}
                        {sourcesWithoutMargin.map(getAdSourceLabel).join(", ")}.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Canaux de notification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CHANNEL_OPTIONS.map(({ key, label, warning }) => (
              <FormField
                key={key}
                control={form.control}
                name={`notificationChannels.${key}`}
                render={({ field }) => (
                  <FormItem className="space-y-2 rounded-lg border border-border bg-card p-3 transition hover:bg-accent">
                    <div className="flex flex-row items-center gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer">{label}</FormLabel>
                    </div>
                    {/* Affiche le warning associé au canal s'il existe et que la case est cochée.
                        Évite de hard-coder un test par canal (ex: `channel === 'whatsapp'`). */}
                    {warning && field.value && (
                      <p className="ml-7 text-xs text-muted-foreground">
                        {warning}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            ))}
            {form.formState.errors.notificationChannels && (
              <p className="text-sm text-destructive">
                {form.formState.errors.notificationChannels.message ??
                  form.formState.errors.notificationChannels.root?.message}
              </p>
            )}
          </CardContent>
        </Card>

        {submitError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="w-full"
        >
          {form.formState.isSubmitting
            ? isEditMode
              ? "Enregistrement en cours…"
              : "Création en cours…"
            : isEditMode
              ? "Enregistrer les modifications"
              : "Créer mon alerte"}
        </Button>
      </form>
    </Form>
  );
}
