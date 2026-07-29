'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyPinAction } from '@/server/actions/publishing';

/**
 * Unos PIN-a za zaštićenu pozivnicu (zahtev 23).
 *
 * PIN se proverava isključivo na serveru; ovde nema ni heša ni tačne vrednosti.
 * Uspešna provera postavlja `httpOnly` kolačić vezan za putanju baš te
 * pozivnice, pa otključavanje jedne ne otključava druge.
 */
export function PinGate({
  slug,
  labels,
}: {
  slug: string;
  labels: {
    label: string;
    submit: string;
    wrong: string;
    tooMany: string;
  };
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await verifyPinAction({ slug, pin });

    if (result.ok) {
      // Osvežavanje stranice: server sada vidi kolačić i renderuje pozivnicu.
      window.location.reload();
      return;
    }

    setBusy(false);
    setError(result.code === 'rate_limited' ? labels.tooMany : labels.wrong);
  };

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-1.5">
        <Label htmlFor="pozivnica-pin">{labels.label}</Label>
        <Input
          id="pozivnica-pin"
          name="pin"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          // Numerička tastatura na telefonu i bez `type=number`, koji bi doneo
          // strelice za povećavanje i gubljenje vodećih nula.
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          required
          className="text-center text-lg tracking-[0.4em]"
        />
      </div>

      <Button type="submit" className="w-full" loading={busy}>
        {labels.submit}
      </Button>
    </form>
  );
}
