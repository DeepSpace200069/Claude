'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { PREFERENCE_KINDS } from '@/features/seating/schemas';
import { addPreferenceAction, removePreferenceAction } from '@/server/actions/seating';
import type { PreferenceKind, PreferenceRow } from '@/server/services/seating';

export type PreferenceGuestOption = { id: string; name: string };

/**
 * Pravila sedenja i posebni zahtevi (zahtev 14).
 *
 * Dva su tipa: odnos između dvoje ljudi („sedi sa", „ne sedi sa") i osobina
 * jednog gosta (stolica za bebe, pristupačno mesto). Prvi daju upozorenja, drugi
 * značku uz ime dok raspoređujete — nijedan ne sprečava organizatora da uradi
 * kako misli da treba.
 */
export function PreferenceManager({
  eventId,
  preferences,
  guests,
  canEdit,
}: {
  eventId: string;
  preferences: readonly PreferenceRow[];
  guests: readonly PreferenceGuestOption[];
  canEdit: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [guestId, setGuestId] = useState('');
  const [kind, setKind] = useState<PreferenceKind>('sit_with');
  const [relatedGuestId, setRelatedGuestId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const needsRelation = kind === 'sit_with' || kind === 'avoid';

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await addPreferenceAction({
      eventId,
      guestId,
      kind,
      relatedGuestId: needsRelation ? relatedGuestId : '',
      note,
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setRelatedGuestId('');
    setNote('');
    router.refresh();
  };

  const selectClass =
    'h-11 w-full rounded-[var(--radius)] border border-input bg-surface px-3.5 text-base md:text-sm';

  return (
    <section
      aria-labelledby="pravila-sedenja"
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
    >
      <h2 id="pravila-sedenja" className="text-sm font-medium">
        {t('seating.preferencesTitle')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('seating.preferencesSubtitle')}
      </p>

      {preferences.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('seating.preferencesEmpty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {preferences.map((preference) => (
            <li
              key={preference.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>
                <strong className="font-medium">{preference.guestName}</strong>{' '}
                {t(`seating.kind${kindKey(preference.kind)}` as 'seating.kindSitWith')}
                {preference.relatedName ? ` ${preference.relatedName}` : ''}
                {preference.note ? (
                  <span className="text-muted-foreground"> · {preference.note}</span>
                ) : null}
              </span>

              <Button
                size="sm"
                variant="ghost"
                disabled={!canEdit}
                onClick={async () => {
                  const result = await removePreferenceAction({
                    eventId,
                    preferenceId: preference.id,
                  });
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  router.refresh();
                }}
              >
                <X aria-hidden />
                <span className="sr-only">{t('seating.removePreference')}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} noValidate className="mt-4 grid gap-3 sm:grid-cols-2">
        {error ? (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        <div>
          <label htmlFor="pravilo-gost" className="mb-1.5 block text-xs font-medium">
            {t('seating.preferenceGuest')}
          </label>
          <select
            id="pravilo-gost"
            className={selectClass}
            value={guestId}
            disabled={!canEdit}
            onChange={(event) => setGuestId(event.target.value)}
          >
            <option value="">—</option>
            {guests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pravilo-vrsta" className="mb-1.5 block text-xs font-medium">
            {t('seating.preferenceKind')}
          </label>
          <select
            id="pravilo-vrsta"
            className={selectClass}
            value={kind}
            disabled={!canEdit}
            onChange={(event) => setKind(event.target.value as PreferenceKind)}
          >
            {PREFERENCE_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`seating.kind${kindKey(value)}` as 'seating.kindSitWith')}
              </option>
            ))}
          </select>
        </div>

        {needsRelation ? (
          <div>
            <label htmlFor="pravilo-drugi" className="mb-1.5 block text-xs font-medium">
              {t('seating.preferenceRelated')}
            </label>
            <select
              id="pravilo-drugi"
              className={selectClass}
              value={relatedGuestId}
              disabled={!canEdit}
              onChange={(event) => setRelatedGuestId(event.target.value)}
            >
              <option value="">—</option>
              {guests
                .filter((guest) => guest.id !== guestId)
                .map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="pravilo-napomena" className="mb-1.5 block text-xs font-medium">
              {t('seating.preferenceNote')}
            </label>
            <Input
              id="pravilo-napomena"
              value={note}
              disabled={!canEdit}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        )}

        <div className="sm:col-span-2">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={pending}
            disabled={!canEdit || guestId === ''}
          >
            <Plus aria-hidden />
            {t('seating.addPreference')}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** `sit_with` → `SitWith`, radi sastavljanja ključa prevoda. */
function kindKey(kind: string): string {
  return kind
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
