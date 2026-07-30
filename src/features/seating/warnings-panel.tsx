import { TriangleAlert } from 'lucide-react';

import type { Messages } from '@/i18n/messages';
import type { Translator } from '@/i18n/translator';
import type { SeatingWarning } from '@/server/services/seating';

/**
 * Upozorenja rasporeda.
 *
 * Server komponenta - upozorenja se računaju na serveru i ovde se samo
 * ispisuju, pa panel ne nosi nijedan bajt JavaScripta.
 *
 * Ton je namerno obaveštajni: ovo su stvari koje organizator treba da vidi, a
 * ne greške koje mora da ispravi. Raspored u kome tetka i teča sede odvojeno
 * može da bude potpuno namerna odluka.
 */
export function WarningsPanel({
  warnings,
  t,
}: {
  warnings: readonly SeatingWarning[];
  t: Translator<Messages>;
}) {
  return (
    <section
      aria-labelledby="upozorenja-rasporeda"
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
    >
      <h2 id="upozorenja-rasporeda" className="flex items-center gap-2 text-sm font-medium">
        <TriangleAlert className="size-4 text-warning" aria-hidden />
        {t('seating.warningsTitle')} ({warnings.length})
      </h2>

      {warnings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('seating.warningsNone')}</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {warnings.map((warning, index) => (
            <li key={`${warning.kind}-${index}`}>{describe(warning, t)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function describe(warning: SeatingWarning, t: Translator<Messages>): string {
  switch (warning.kind) {
    case 'over_capacity':
      return t('seating.warningOverCapacity', {
        table: warning.tableName,
        seated: warning.seated,
        capacity: warning.capacity,
      });
    case 'separated':
      return t('seating.warningSeparated', {
        guest: warning.guestName,
        other: warning.otherName,
      });
    case 'together':
    default:
      return t('seating.warningTogether', {
        guest: warning.guestName,
        other: warning.otherName,
        table: warning.tableName,
      });
  }
}
