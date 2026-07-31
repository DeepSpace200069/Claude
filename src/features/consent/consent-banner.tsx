'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';

import { decideConsent, useConsent, useConsentReady } from './consent-store';

/**
 * Traka za pristanak (zahtev 29).
 *
 * Pravila koja su vodila oblik:
 *
 * - **Dva ravnopravna dugmeta.** „Prihvati sve” i „Samo neophodno” izgledaju
 *   isto i stoje jedno pored drugog; odbijanje ne sme da bude teže od
 *   prihvatanja.
 * - **Ništa se ne upisuje pre odluke.** Traka ne postavlja kolačić dok korisnik
 *   ne klikne, a merenje čeka pristanak.
 * - **Ne blokira stranicu.** Nema prekrivača preko sadržaja: gost je došao da
 *   vidi pozivnicu, a ne da rešava naš pravni problem. Bez odluke važi
 *   „samo neophodno”, pa čekanje ništa ne krši.
 *
 * Odluka se čita u pregledaču, pa server ne mora da vidi kolačić - javna
 * pozivnica time ostaje keširana.
 */
export function ConsentBanner({
  labels,
}: {
  labels: {
    title: string;
    text: string;
    acceptAll: string;
    necessaryOnly: string;
    more: string;
  };
}) {
  const consent = useConsent();
  const ready = useConsentReady();

  // Do prve provere se ne prikazuje ništa: traka koja bljesne pa nestane
  // izgleda kao greška. Posle nje se prikazuje samo ako odluke nema.
  if (!ready || consent !== null) return null;

  return (
    <>
      {/*
        Traka je `fixed`, pa bi bez ovoga prekrila dno stranice - a to nije
        kozmetika: dugme ispod nje se ne može ni kliknuti. Odstojnik produžava
        dokument tačno toliko da sve ostane dohvatljivo.
      */}
      <div aria-hidden className="h-44 sm:h-28" />

      <div
        // `region` sa imenom: čitač ekrana može da je pronađe i preskoči.
        role="region"
        aria-label={labels.title}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 p-4 shadow-lifted backdrop-blur-md"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{labels.title}</span>{' '}
            {labels.text}{' '}
            <Link href="/kolacici" className="underline underline-offset-4">
              {labels.more}
            </Link>
          </p>

          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => decideConsent('neophodno')}
            >
              {labels.necessaryOnly}
            </Button>
            <Button type="button" onClick={() => decideConsent('sve')}>
              {labels.acceptAll}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
