'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/i18n/client';

/**
 * Prikaz upravo izdatog ličnog linka.
 *
 * Link se u bazi čuva samo kao heš, pa je ovo jedini trenutak kada iko može da
 * ga pročita. Zato dijalog to i kaže naglas, umesto da korisnik kasnije traži
 * dugme „prikaži link” koje ne može da postoji (zahtev 39.6).
 */
export function IssuedLinkDialog({
  url,
  onClose,
}: {
  url: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  return (
    <Dialog
      open={url !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('guests.columnLink')}</DialogTitle>
          <DialogDescription>{t('guests.linkOnce')}</DialogDescription>
        </DialogHeader>

        <Input
          readOnly
          value={url ?? ''}
          aria-label={t('guests.columnLink')}
          onFocus={(event) => event.currentTarget.select()}
        />

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (!url) return;
              void navigator.clipboard
                .writeText(url)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? t('guests.linkCopied') : t('guests.linkCopy')}
          </Button>
          <Button type="button" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
