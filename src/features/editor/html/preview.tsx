'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type {
  FieldDefinitions,
  FieldValues,
} from '@/features/templates/html-schema';
import {
  renderInvitationHtml,
  resolveFieldValues,
  type ValueResolution,
} from '@/features/templates/html-values';
import { useTranslations } from '@/i18n/client';

/**
 * Živi pregled uvezenog sajta (zahtev 39.4).
 *
 * Sajt se prikazuje u `<iframe>`-u, jer donosi **svoj** `<html>`, svoje stilove
 * i svoje skripte; ubacivanje toga u stranicu uređivača pomešalo bi dva skupa
 * stilova i pokvarilo oba.
 *
 * Ključna odluka je kako se pregled osvežava. Ponovno učitavanje pri svakom
 * pritisnutom tasteru bilo bi tačno, ali bi svaki put vratilo animacije na
 * početak - a animacije su ceo razlog zbog kog ovakav šablon i postoji. Zato se
 * pregled učita **jednom**, a izmene se posle toga unose tačno tamo gde pripadaju,
 * preko istih selektora koje šablon nosi u definicijama polja. Tekst se upisuje
 * kroz `textContent`, pa se ni ovde ništa ne tumači kao HTML.
 *
 * Polja koja ulaze u JavaScript šablona (odbrojavanje, koordinate) se ovako ne
 * mogu izmeniti - skripta je već odradila svoje. Za njih postoji dugme za
 * osvežavanje, a uređivač kaže i zašto.
 */
export function HtmlPreview({
  document: templateDocument,
  definitions,
  values,
  resolution,
}: {
  document: string;
  definitions: FieldDefinitions;
  values: FieldValues;
  resolution: ValueResolution;
}) {
  const t = useTranslations();
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * Stanje od kog pregled kreće.
   *
   * Menja se samo pri osvežavanju, pa se `srcDoc` ne računa iznova dok se kuca.
   * Prvi prikaz je odmah popunjen - bez treptaja šablonskog teksta.
   *
   * Uz vrednosti se pamti i razrešavanje adresa: nova otpremljena fotografija
   * menja `resolution`, a to ne sme da ponovo učita pregled i vrati animacije
   * na početak. Sama slika se u prikazu pojavi kroz izmenu atributa, kao i svaka
   * druga vrednost polja.
   */
  const [baseline, setBaseline] = useState({ values, resolution });

  const srcDoc = useMemo(
    () =>
      renderInvitationHtml({
        document: templateDocument,
        definitions,
        values: baseline.values,
        resolution: baseline.resolution,
      }),
    [templateDocument, definitions, baseline],
  );

  const resolved = useMemo(
    () => resolveFieldValues(definitions, values, resolution),
    [definitions, values, resolution],
  );

  /** Polja koja žive u skripti šablona; njih pregled ne može da izmeni u hodu. */
  const scriptOnly = useMemo(() => {
    const keys = new Set<string>();
    for (const field of definitions.fields) {
      if (field.bind.every((binding) => binding.kind === 'script')) keys.add(field.key);
    }
    return keys;
  }, [definitions]);

  const apply = useCallback(() => {
    const frame = frameRef.current?.contentDocument;
    if (!frame) return;

    for (const field of definitions.fields) {
      const value = resolved[field.key] ?? '';

      for (const binding of field.bind) {
        if (binding.kind === 'script') continue;

        for (const element of frame.querySelectorAll(binding.selector)) {
          if (binding.kind === 'text') element.textContent = value;
          else element.setAttribute(binding.attr, value);
        }
      }
    }
  }, [definitions, resolved]);

  useEffect(() => {
    apply();
  }, [apply]);

  /**
   * Da li prikaz zaostaje za formom.
   *
   * Izvedeno iz stanja, a ne pamćeno: pamćeno bi značilo da se pri svakoj
   * izmeni proverava i upisuje zastavica, pa bi povratak na staru vrednost
   * ostavio upozorenje koje više nije tačno.
   */
  const stale = useMemo(() => {
    for (const key of scriptOnly) {
      if ((values[key] ?? '') !== (baseline.values[key] ?? '')) return true;
    }
    return false;
  }, [values, baseline, scriptOnly]);

  const refresh = () => setBaseline({ values, resolution });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('editor.preview.title')}</h2>
        <Button type="button" variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className="size-3.5" aria-hidden />
          {t('editor.html.refreshPreview')}
        </Button>
      </div>

      {stale ? (
        <p role="status" className="text-xs text-muted-foreground">
          {t('editor.html.scriptFieldHint')}
        </p>
      ) : null}

      {/*
        `allow-same-origin` je potreban da bi uređivač mogao da unosi izmene u
        prikaz bez ponovnog učitavanja. Ono što `sandbox` i dalje brani je ono
        što ovde i jeste rizik: pregled ne može da odvede korisnika sa stranice,
        da otvori novi prozor ni da pošalje formu. Sam sadržaj je šablon koji je
        uvezao administrator - isti kod koji se izvršava i na javnoj pozivnici.
      */}
      <iframe
        ref={frameRef}
        title={t('editor.preview.title')}
        srcDoc={srcDoc}
        onLoad={apply}
        sandbox="allow-scripts allow-same-origin"
        className="h-[36rem] w-full rounded-[var(--radius-md)] border border-border bg-white"
      />
    </div>
  );
}
