'use client';

import { Home, Link2, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import {
  createHouseholdAction,
  deleteHouseholdAction,
  issueRecipientLinkAction,
  updateHouseholdAction,
} from '@/server/actions/guests';

import { IssuedLinkDialog } from './issued-link-dialog';

export type HouseholdItem = {
  id: string;
  name: string;
  maxGuests: number | null;
  notes: string | null;
  guestCount: number;
};

/**
 * Domaćinstva (zahtev 12 i 13).
 *
 * Porodica dobija jedan link i odgovara zajedno. Zato link ovde stoji uz
 * domaćinstvo, a ne uz svakog člana - inače bi ista porodica dobila četiri
 * linka i četiri odgovora.
 */
export function HouseholdManager({
  eventId,
  households,
}: {
  eventId: string;
  households: readonly HouseholdItem[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [editing, setEditing] = useState<HouseholdItem | null>(null);
  const [open, setOpen] = useState(false);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);

  const issueLink = async (household: HouseholdItem): Promise<void> => {
    const result = await issueRecipientLinkAction({
      eventId,
      guestId: '',
      householdId: household.id,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setIssuedLink(result.data.url);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <Home aria-hidden />
        {t('guests.addHousehold')}
      </Button>

      {households.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('guests.householdsEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-surface">
          {households.map((household) => (
            <li
              key={household.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="font-medium">{household.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('guests.householdGuests')}: {household.guestCount}
                  {household.maxGuests !== null
                    ? ` · ${t('guests.householdMaxGuests')}: ${household.maxGuests}`
                    : ''}
                </p>
                {household.notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{household.notes}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void issueLink(household)}
                >
                  <Link2 aria-hidden />
                  {t('guests.issueLink')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(household);
                    setOpen(true);
                  }}
                >
                  <Pencil aria-hidden />
                  <span className="sr-only">{t('guests.editHousehold')}</span>
                </Button>

                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      <Trash2 aria-hidden />
                      <span className="sr-only">{t('guests.deleteHousehold')}</span>
                    </Button>
                  }
                  title={t('guests.deleteHousehold')}
                  description={t('guests.deleteHouseholdConfirm')}
                  confirmLabel={t('common.delete')}
                  cancelLabel={t('common.cancel')}
                  onConfirm={async () => {
                    const result = await deleteHouseholdAction({
                      eventId,
                      householdId: household.id,
                    });
                    if (!result.ok) return result.message;
                    router.refresh();
                    return null;
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <HouseholdDialog
        key={editing?.id ?? 'novo'}
        eventId={eventId}
        household={editing}
        open={open}
        onOpenChange={setOpen}
      />

      <IssuedLinkDialog url={issuedLink} onClose={() => setIssuedLink(null)} />
    </div>
  );
}

function HouseholdDialog({
  eventId,
  household,
  open,
  onOpenChange,
}: {
  eventId: string;
  household: HouseholdItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [name, setName] = useState(household?.name ?? '');
  const [maxGuests, setMaxGuests] = useState(
    household?.maxGuests === null || household?.maxGuests === undefined
      ? ''
      : String(household.maxGuests),
  );
  const [notes, setNotes] = useState(household?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload = { eventId, name, maxGuests, notes };
    const result = household
      ? await updateHouseholdAction({ ...payload, householdId: household.id })
      : await createHouseholdAction(payload);

    setPending(false);

    if (!result.ok) {
      setError(result.fieldErrors?.name?.[0] ?? result.message);
      return;
    }

    toast.success(t('guests.saved'));
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {household ? t('guests.editHousehold') : t('guests.addHousehold')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label={t('guests.householdName')} required>
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                />
              )}
            </FieldControl>
          </Field>

          <Field
            label={t('guests.householdMaxGuests')}
            hint={t('guests.householdMaxGuestsHint')}
            optionalLabel={t('common.optional')}
          >
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={50}
                  value={maxGuests}
                  onChange={(event) => setMaxGuests(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>

          <Field
            label={t('guests.householdNotes')}
            optionalLabel={t('common.optional')}
          >
            <FieldControl>
              {(props) => (
                <Textarea
                  {...props}
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={pending}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
