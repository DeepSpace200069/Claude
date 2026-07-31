'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';

import type { AdminActionResult } from './admin-controls';

/**
 * Pravljenje promo koda (zahtev 7.3).
 *
 * Vrsta „pun popust” nema iznos, pa se polje vrednosti sakriva - polje koje ne
 * utiče ni na šta samo navodi na pogrešan zaključak da je uneta vrednost bitna.
 */
export function PromoForm({
  create,
}: {
  create: (input: Record<string, unknown>) => Promise<AdminActionResult>;
}) {
  const t = useTranslations();

  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'fixed' | 'free'>('percent');
  const [value, setValue] = useState('10');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});

    const result = await create({
      code,
      kind,
      value: kind === 'free' ? 0 : Number(value || 0),
      maxRedemptions: maxRedemptions.trim() === '' ? null : Number(maxRedemptions),
      validUntil: validUntil || undefined,
    });

    setBusy(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setError(result.fieldErrors ? null : result.message);
      return;
    }

    setCode('');
    setMaxRedemptions('');
    setValidUntil('');
    toast.success(t('admin.promoCreated'));
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.promoCode')} error={errors.code?.[0]} required>
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </FieldControl>
        </Field>

        <Field label={t('admin.promoKind')}>
          <FieldControl>
            {(controlProps) => (
              <Select
                value={kind}
                onValueChange={(next) =>
                  setKind(next as 'percent' | 'fixed' | 'free')
                }
              >
                <SelectTrigger id={controlProps.id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{t('admin.promoKindPercent')}</SelectItem>
                  <SelectItem value="fixed">{t('admin.promoKindFixed')}</SelectItem>
                  <SelectItem value="free">{t('admin.promoKindFree')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </FieldControl>
        </Field>

        {kind === 'free' ? null : (
          <Field label={t('admin.promoValue')} error={errors.value?.[0]}>
            <FieldControl>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  inputMode="numeric"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>
        )}

        <Field label={t('admin.promoMax')}>
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                inputMode="numeric"
                value={maxRedemptions}
                onChange={(event) => setMaxRedemptions(event.target.value)}
              />
            )}
          </FieldControl>
        </Field>

        <Field label={t('admin.promoValidUntil')}>
          <FieldControl>
            {(controlProps) => (
              <Input
                {...controlProps}
                type="date"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            )}
          </FieldControl>
        </Field>
      </div>

      <Button type="submit" loading={busy}>
        {t('admin.promoCreate')}
      </Button>
    </form>
  );
}
