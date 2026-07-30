'use client';

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { useTranslations } from '@/i18n/client';
import type { UnseatedGuest } from '@/server/services/seating';

import { GuestChip } from './guest-chip';
import { SeatSelect, type SeatTableOption } from './seat-select';

/**
 * Gosti koji još nemaju mesto.
 *
 * Lista je i polazna tačka i merilo napretka: kada se isprazni, raspored je
 * gotov. Zato stoji uz platno, a ne u zasebnoj kartici koja se otvara.
 */
export function UnseatedPanel({
  guests,
  tables,
  disabled,
  onSeat,
}: {
  guests: readonly UnseatedGuest[];
  tables: readonly SeatTableOption[];
  disabled: boolean;
  onSeat: (tableId: string, guestId: string) => void;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? guests.filter((guest) => guest.name.toLowerCase().includes(normalized))
    : guests;

  return (
    <section
      aria-labelledby="neraspoređeni"
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
    >
      <h2 id="neraspoređeni" className="text-sm font-medium">
        {t('seating.unseatedTitle')} ({guests.length})
      </h2>

      {guests.length > 8 ? (
        <Input
          type="search"
          className="mt-2 h-9"
          aria-label={t('seating.searchGuests')}
          placeholder={t('seating.searchGuests')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}

      {guests.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('seating.unseatedEmpty')}
        </p>
      ) : (
        <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto">
          {visible.map((guest) => (
            <li key={guest.id}>
              <GuestChip
                guestId={guest.id}
                name={guest.name}
                isChild={guest.isChild}
                needs={guest.needs}
                dragDisabled={disabled}
              >
                <SeatSelect
                  label={t('seating.assignTo', { name: guest.name })}
                  placeholder={t('seating.assignPlaceholder')}
                  tables={tables}
                  disabled={disabled || tables.length === 0}
                  onSelect={(tableId) => onSeat(tableId, guest.id)}
                />
              </GuestChip>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
