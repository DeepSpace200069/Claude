'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/toggles';
import { toast } from '@/components/ui/toaster';
import {
  FEATURE_FLAGS,
  FEATURE_LIMITS,
  type FeatureFlag,
  type FeatureLimit,
  type PlanFeatures,
} from '@/features/billing/entitlements';
import { useTranslations } from '@/i18n/client';

import type { AdminActionResult } from './admin-controls';

/**
 * Prekidač sa labelom.
 *
 * Uređivač ima sličan, ali bez `disabled` - podrazumevani paket mora da se
 * prikaže onemogućen, a ne sakriven, da bi se videlo zašto ne može da se
 * isključi.
 */
function ToggleRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}

/**
 * Uređivanje paketa i limita (zahtev 7.7 i 39.9).
 *
 * Limit se unosi kao broj ili se ostavlja prazan; prazno polje znači **bez
 * ograničenja**, što je jedina razlika između „nula” i „neograničeno” koju
 * korisnik vidi. Zato se prazan unos šalje kao `null`, a ne kao 0.
 */
export function PlanForm({
  plan,
  featureLabels,
  limitLabels,
  save,
}: {
  plan: {
    id: string;
    code: string;
    name: string;
    description: string;
    priceMinor: number;
    isActive: boolean;
    isDefault: boolean;
    features: PlanFeatures;
  };
  featureLabels: Record<FeatureFlag, string>;
  limitLabels: Record<FeatureLimit, string>;
  save: (input: Record<string, unknown>) => Promise<AdminActionResult>;
}) {
  const t = useTranslations();

  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [priceMinor, setPriceMinor] = useState(String(plan.priceMinor));
  const [isActive, setIsActive] = useState(plan.isActive);
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag, plan.features.flags[flag] ?? false])),
  );
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      FEATURE_LIMITS.map((limit) => {
        const value = plan.features.limits[limit];
        return [limit, value === null || value === undefined ? '' : String(value)];
      }),
    ),
  );

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await save({
      planId: plan.id,
      name,
      description,
      priceMinor: Number(priceMinor),
      isActive,
      features: {
        flags,
        limits: Object.fromEntries(
          Object.entries(limits).map(([key, value]) => [
            key,
            value.trim() === '' ? null : Number(value),
          ]),
        ),
      },
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast.success(t('admin.plansSaved'));
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.plansName')} required>
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FieldControl>
        </Field>

        <Field label={t('admin.plansPrice')}>
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                inputMode="numeric"
                value={priceMinor}
                onChange={(event) => setPriceMinor(event.target.value)}
              />
            )}
          </FieldControl>
        </Field>
      </div>

      <Field label={t('admin.plansDescription')}>
        <FieldControl>
          {(controlProps) => (
            <Textarea
              {...controlProps}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </FieldControl>
      </Field>

      <ToggleRow
        checked={isActive}
        onChange={setIsActive}
        label={t('admin.plansActive')}
        // Podrazumevani paket ne sme da se isključi; server to isto odbija.
        disabled={plan.isDefault}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('admin.plansFlags')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURE_FLAGS.map((flag) => (
            <ToggleRow
              key={flag}
              checked={flags[flag] ?? false}
              onChange={(next) => setFlags((current) => ({ ...current, [flag]: next }))}
              label={featureLabels[flag]}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('admin.plansLimits')}</legend>
        <p className="text-xs text-muted-foreground">{t('admin.plansLimitHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURE_LIMITS.map((limit) => (
            <Field key={limit} label={limitLabels[limit]}>
              <FieldControl>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    inputMode="numeric"
                    value={limits[limit] ?? ''}
                    onChange={(event) =>
                      setLimits((current) => ({ ...current, [limit]: event.target.value }))
                    }
                  />
                )}
              </FieldControl>
            </Field>
          ))}
        </div>
      </fieldset>

      <Button type="submit" loading={busy}>
        {t('common.save')}
      </Button>
    </form>
  );
}
