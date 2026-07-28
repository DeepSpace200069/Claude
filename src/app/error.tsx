'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Globalna granica greške.
 *
 * Tekst je namerno na jednom jeziku: ako render padne, i sam sistem prevoda
 * može biti uzrok, pa poruka ne sme da zavisi od njega.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] Neuhvaćena greška:', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-semibold">
        Nešto je pošlo naopako
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Došlo je do neočekivane greške. Pokušajte ponovo za koji trenutak.
      </p>
      {error.digest ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Kod greške: {error.digest}
        </p>
      ) : null}
      <Button className="mt-8" onClick={reset}>
        Pokušaj ponovo
      </Button>
    </div>
  );
}
