'use client';

import { Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
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
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/i18n/client';

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Preuzimanje podataka i brisanje naloga (zahtev 25).
 *
 * Preuzimanje je obična veza na rutu koja vraća fajl - radi i bez JavaScripta.
 * Brisanje traži ukucanu reč, jer je to jedina radnja u aplikaciji koja se ne
 * može poništiti, a ekran pre nje kaže **tačno** šta nestaje i šta ostaje.
 */
export function DataControls({
  downloadHref,
  preview,
  confirmationWord,
  retentionDays,
  deleteAccount,
}: {
  downloadHref: string;
  preview: { events: number; guests: number; responses: number; orders: number };
  confirmationWord: string;
  retentionDays: number;
  deleteAccount: (input: {
    confirmation: string;
  }) => Promise<ActionResult<{ deletedEvents: number }>>;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    setBusy(true);
    setError(null);

    const result = await deleteAccount({ confirmation });
    setBusy(false);

    if (!result.ok) {
      setError(result.fieldErrors?.confirmation?.[0] ?? result.message);
      return;
    }

    setOpen(false);
    // Nalog više ne postoji; ostanak u aplikaciji bi bio prazan ekran.
    router.replace('/');
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('profile.exportTitle')}</h3>
        <p className="text-sm text-muted-foreground">{t('profile.exportText')}</p>
        <Button asChild variant="secondary">
          <a href={downloadHref} download>
            <Download aria-hidden />
            {t('profile.exportAction')}
          </a>
        </Button>
      </div>

      <div className="space-y-2 border-t border-border pt-6">
        <h3 className="text-sm font-medium">{t('profile.deleteTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('profile.deleteText', { days: retentionDays })}
        </p>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="destructive">
              <Trash2 aria-hidden />
              {t('profile.deleteAction')}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('profile.deleteTitle')}</DialogTitle>
              <DialogDescription>
                {t('profile.deleteSummary', {
                  events: preview.events,
                  guests: preview.guests,
                  responses: preview.responses,
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {error ? <Alert tone="error">{error}</Alert> : null}

              {preview.orders > 0 ? (
                <Alert tone="info">
                  {t('profile.deleteOrdersNote', { orders: preview.orders })}
                </Alert>
              ) : null}

              <Field
                label={t('profile.deleteConfirmLabel', { word: confirmationWord })}
                required
              >
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
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                loading={busy}
                disabled={confirmation.trim() === ''}
                onClick={() => void onDelete()}
              >
                {t('profile.deleteAction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
