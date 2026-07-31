'use client';

import { CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { cn } from '@/lib/utils';

/** Paket kakav vidi korisnik pri izboru - bez ijednog podatka o drugim događajima. */
export type PurchasablePlan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price: string;
  /** Sažete mogućnosti, već prevedene na serveru. */
  highlights: string[];
  isCurrent: boolean;
  isPurchasable: boolean;
};

export type CheckoutOutcome = {
  redirectUrl: string | null;
  alreadyPaid: boolean;
};

/**
 * Izbor paketa za **jednu** pozivnicu (zahtev 17).
 *
 * Akcija stiže kao prop, ne uvozom: tako serverski graf ostaje van klijentskog
 * bundla. Dugme se ne krije kada paket ne može da se kupi - stoji onemogućeno
 * uz razlog, jer sakriveno dugme ostavlja korisnika bez objašnjenja.
 */
export function CheckoutPanel({
  eventId,
  plans,
  startCheckout,
}: {
  eventId: string;
  plans: PurchasablePlan[];
  startCheckout: (input: {
    eventId: string;
    planId: string;
    promoCode?: string;
  }) => Promise<
    | { ok: true; data: CheckoutOutcome }
    | { ok: false; message: string; fieldErrors?: Record<string, string[]> }
  >;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [selected, setSelected] = useState<string | null>(
    plans.find((plan) => plan.isPurchasable && !plan.isCurrent)?.id ?? null,
  );
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;

    setBusy(true);
    setError(null);
    setPromoError(null);

    const result = await startCheckout({
      eventId,
      planId: selected,
      promoCode: promoCode.trim() || undefined,
    });

    setBusy(false);

    if (!result.ok) {
      setPromoError(result.fieldErrors?.promoCode?.[0] ?? null);
      setError(result.fieldErrors?.promoCode?.[0] ? null : result.message);
      return;
    }

    if (result.data.alreadyPaid) {
      toast.success(t('billing.activated'));
      router.refresh();
      return;
    }

    if (result.data.redirectUrl) {
      // Provajder preuzima korisnika odavde; povratak vodi na istu stranicu.
      window.location.href = result.data.redirectUrl;
      return;
    }

    router.refresh();
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t('billing.choosePlan')}</legend>

        {plans.map((plan) => {
          const disabled = !plan.isPurchasable;

          return (
            <label
              key={plan.id}
              className={cn(
                'flex cursor-pointer gap-3 rounded-[var(--radius)] border p-4 transition-colors',
                selected === plan.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/40',
                disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
              )}
            >
              <input
                type="radio"
                name="plan"
                value={plan.id}
                className="mt-1 size-4 accent-[var(--color-primary)]"
                checked={selected === plan.id}
                disabled={disabled}
                onChange={() => setSelected(plan.id)}
              />

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{plan.name}</span>
                  {plan.isCurrent ? (
                    <Badge variant="success">{t('billing.currentPlan')}</Badge>
                  ) : null}
                  <span className="ms-auto font-display text-lg font-semibold">
                    {plan.price}
                  </span>
                </span>

                <span className="mt-1 block text-sm text-muted-foreground">
                  {plan.description}
                </span>

                {plan.highlights.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                    {plan.highlights.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      <Field
        label={t('billing.promoLabel')}
        hint={t('billing.promoHint')}
        error={promoError ?? undefined}
      >
        <FieldControl>
          {(controlProps) => (
            <Input
              {...controlProps}
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </FieldControl>
      </Field>

      <div className="space-y-2">
        <Button type="submit" loading={busy} disabled={!selected}>
          <CreditCard aria-hidden />
          {t('billing.pay')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('billing.payHint')}</p>
      </div>
    </form>
  );
}
