'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldControl } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { TranslationsProvider, useTranslations } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import type { MessageTree } from '@/i18n/translator';
import { deleteEventAction } from '@/server/actions/events';

/**
 * Brisanje događaja.
 *
 * Potvrda traži da korisnik otkuca naziv događaja: brisanje uklanja i sve
 * podatke o gostima, pa jedan klik nije dovoljna zaštita (zahtev 30).
 */
export function DeleteEventCard(props: {
  locale: Locale;
  messages: MessageTree;
  eventId: string;
  eventName: string;
}) {
  return (
    <TranslationsProvider locale={props.locale} messages={props.messages}>
      <DeleteCardInner eventId={props.eventId} eventName={props.eventName} />
    </TranslationsProvider>
  );
}

function DeleteCardInner({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    setError(null);

    const result = await deleteEventAction({ id: eventId, confirmation });
    setPending(false);

    if (result.ok) {
      toast.success(t('events.deleted'));
      setOpen(false);
      router.push('/app/dogadjaji');
      router.refresh();
      return;
    }

    setError(result.fieldErrors?.confirmation?.[0] ?? result.message);
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">{t('settings.dangerTitle')}</CardTitle>
        <CardDescription>{t('settings.dangerSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 aria-hidden />
              {t('settings.deleteEvent')}
            </Button>
          </DialogTrigger>

          <DialogContent closeLabel={t('common.close')}>
            <DialogHeader>
              <DialogTitle>{t('events.deleteTitle')}</DialogTitle>
              <DialogDescription>
                {t('events.deleteConfirm', { name: eventName })}
              </DialogDescription>
            </DialogHeader>

            <Field label={eventName} error={error ?? undefined} required>
              <FieldControl>
                {(controlProps) => (
                  <Input
                    {...controlProps}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                  />
                )}
              </FieldControl>
            </Field>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                loading={pending}
                disabled={confirmation.trim() !== eventName.trim()}
              >
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
