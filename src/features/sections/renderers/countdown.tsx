'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { z } from 'zod';

import type { countdownSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';

type CountdownData = z.infer<typeof countdownSection.schema>;

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function remainingUntil(target: number, now: number): Remaining | null {
  const diff = target - now;
  if (diff <= 0) return null;

  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/**
 * Odbrojavanje.
 *
 * Jedina sekcija kojoj interaktivnost zaista treba. Sat je spoljni izvor
 * podataka koji se menja sam od sebe, pa se čita kroz `useSyncExternalStore`, a
 * ne kroz `useState` + `useEffect`: React tako sam vodi računa o pretplati i
 * nema kaskadnih rendera.
 *
 * Serverski snimak je `null` - server i pregledač su u različitim trenucima, pa
 * bi bilo koja serverska vrednost izazvala hydration neslaganje i "skok"
 * brojeva pri hidrataciji.
 */
export function CountdownRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<CountdownData>) {
  const target = event.startsAt ? new Date(event.startsAt).getTime() : null;

  // Bez sekundi je dovoljno osvežavati ređe - manje posla za bateriju telefona
  // koji gost drži u ruci.
  const tickMs = data.showSeconds ? 1000 : 30_000;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = window.setInterval(onChange, tickMs);
      return () => window.clearInterval(timer);
    },
    [tickMs],
  );

  // Vrednost se zaokružuje na korak osvežavanja da bi bila stabilna između
  // otkucaja: `getSnapshot` mora da vrati istu vrednost dok se ništa nije
  // promenilo, inače React ulazi u beskonačnu petlju.
  const getSnapshot = useCallback(
    () => Math.floor(Date.now() / tickMs) * tickMs,
    [tickMs],
  );

  const now = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const remaining = useMemo(
    () => (target === null || now === null ? null : remainingUntil(target, now)),
    [target, now],
  );

  if (target === null) return null;

  const labels = LABELS[locale] ?? SR_LATN_LABELS;
  const headingId = `odbrojavanje-${index}`;
  const isReady = now !== null;
  const isPast = isReady && remaining === null;

  const units = remaining
    ? [
        { key: 'days', value: remaining.days, label: labels.days },
        { key: 'hours', value: remaining.hours, label: labels.hours },
        { key: 'minutes', value: remaining.minutes, label: labels.minutes },
        ...(data.showSeconds
          ? [{ key: 'seconds', value: remaining.seconds, label: labels.seconds }]
          : []),
      ]
    : // Pre hidratacije prikazujemo prazne okvire da se raspored ne pomeri.
      ['days', 'hours', 'minutes', ...(data.showSeconds ? ['seconds'] : [])].map(
        (key) => ({ key, value: null, label: labels[key as keyof CountdownLabels] }),
      );

  return (
    <section
      className="inv-section inv-reveal"
      aria-labelledby={headingId}
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className="inv-container inv-stack inv-center">
        {data.title ? (
          <h2 id={headingId}>{data.title}</h2>
        ) : (
          <span id={headingId} className="sr-only" />
        )}

        {isPast ? (
          <p className="inv-muted">{data.afterEventText || labels.past}</p>
        ) : (
          <ul className={`inv-countdown inv-countdown--${data.style}`}>
            {units.map((unit) => (
              <li key={unit.key} className="inv-countdown__unit">
                <span className="inv-countdown__value">
                  {unit.value ?? '–'}
                </span>
                <span className="inv-countdown__label">{unit.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type CountdownLabels = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  past: string;
};

const SR_LATN_LABELS: CountdownLabels = {
  days: 'dana',
  hours: 'sati',
  minutes: 'minuta',
  seconds: 'sekundi',
  past: 'Događaj je prošao.',
};

/**
 * Nazivi jedinica.
 *
 * Namerno su ovde, a ne u glavnom katalogu prevoda: ovo je jedina klijentska
 * sekcija, pa bi prosleđivanje celog kataloga poništilo trud oko veličine
 * bundle-a javne pozivnice.
 */
const LABELS: Record<string, CountdownLabels> = {
  'sr-Latn': SR_LATN_LABELS,
  'sr-Cyrl': {
    days: 'дана',
    hours: 'сати',
    minutes: 'минута',
    seconds: 'секунди',
    past: 'Догађај је прошао.',
  },
  en: {
    days: 'days',
    hours: 'hours',
    minutes: 'minutes',
    seconds: 'seconds',
    past: 'This event has passed.',
  },
  de: {
    days: 'Tage',
    hours: 'Stunden',
    minutes: 'Minuten',
    seconds: 'Sekunden',
    past: 'Die Feier ist vorbei.',
  },
};
