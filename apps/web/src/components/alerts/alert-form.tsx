'use client';

import { createAlert, updateAlert } from '@/actions/alert.actions';
import type { TAccountAlert } from '@/services/alert.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getErrorMessage } from '@/utils/error-messages.utils';
import { alertFormSchema, type TAlertFormData } from '@/validation-schemas';
import type { TBrand, TLocation, TVehicleModel } from '@alertdeals/db';
import { ALERT_MODE_DEFINITIONS, EAlertMode } from '@alertdeals/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { LocationSearch } from './location-search';

type Props = {
  brands: TBrand[];
  vehicleModels: TVehicleModel[];
  isSubscribed: boolean;
  alert?: TAccountAlert;
};

export function AlertForm({ brands, vehicleModels, isSubscribed, alert }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditMode = !!alert;

  const form = useForm<TAlertFormData>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      name: alert?.name ?? null,
      brandId: alert?.brandId ?? null,
      modelId: alert?.modelId ?? null,
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
      notificationChannels: alert?.notificationChannels ?? {
        email: true,
        phone: false,
        whatsapp: false,
      },
    },
  });

  const selectedBrandId = useWatch({ control: form.control, name: 'brandId' });
  const selectedMode = useWatch({ control: form.control, name: 'mode' });
  // Local state to display the selected location's name/zipcode in the LocationSearch trigger.
  // The form only stores the locationId, which is what the server action expects.
  const [selectedLocation, setSelectedLocation] = useState<TLocation | null>(
    alert?.location ?? null,
  );

  const filteredModels = useMemo(() => {
    if (!selectedBrandId) return [];
    return vehicleModels.filter((m) => m.brandId === selectedBrandId);
  }, [selectedBrandId, vehicleModels]);

  const onSubmit = async (data: TAlertFormData) => {
    setSubmitError(null);
    try {
      if (isEditMode) {
        await updateAlert(alert.id, data);
      } else {
        await createAlert(data);
      }
      toast.success(
        isEditMode ? 'Alerte mise à jour avec succès !' : 'Alerte créée avec succès !',
      );
      router.push('/alerts');
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  if (!isSubscribed && !isEditMode) {
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
            <a href="/subscription">S'abonner</a>
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
              <FormLabel>Nom de l'alerte</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex. Peugeot 208 Île-de-France"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>Optionnel — pour retrouver l'alerte plus facilement.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle>Critères de recherche</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="brandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marque</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      form.setValue('modelId', null);
                    }}
                    value={field.value?.toString() ?? ''}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Toutes les marques" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {brands.map((b) => (
                        <SelectItem key={b.id} value={b.id.toString()}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="modelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modèle</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    value={field.value?.toString() ?? ''}
                    disabled={!selectedBrandId}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            selectedBrandId
                              ? 'Tous les modèles'
                              : "Sélectionnez d'abord une marque"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredModels.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Input type="number" placeholder="2018" {...field} value={field.value ?? ''} />
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
                    <Input type="number" placeholder="2024" {...field} value={field.value ?? ''} />
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
                    <Input type="number" placeholder="0" {...field} value={field.value ?? ''} />
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
                      placeholder="150000"
                      {...field}
                      value={field.value ?? ''}
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
                  <FormLabel>Localisation</FormLabel>
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
                  <FormLabel>Périmètre (km)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="50" {...field} value={field.value ?? ''} />
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
                    <Input type="number" placeholder="3000" {...field} value={field.value ?? ''} />
                  </FormControl>
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
                        placeholder="15000"
                        {...field}
                        value={field.value ?? ''}
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
                        step="0.1"
                        placeholder="15"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
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
            {(['email', 'phone', 'whatsapp'] as const).map((channel) => (
              <FormField
                key={channel}
                control={form.control}
                name={`notificationChannels.${channel}`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-lg border border-border bg-card p-3 transition hover:bg-accent">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="cursor-pointer capitalize">{channel}</FormLabel>
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

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting
            ? isEditMode
              ? 'Enregistrement en cours…'
              : 'Création en cours…'
            : isEditMode
              ? 'Enregistrer les modifications'
              : 'Créer mon alerte'}
        </Button>
      </form>
    </Form>
  );
}
