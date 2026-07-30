'use client';

import { UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/i18n/client';

import { GuestDialog, type GuestDialogHousehold } from './guest-dialog';

/** Dugme „dodaj gosta” sa svojim dijalogom; drži samo stanje otvorenosti. */
export function AddGuestButton({
  eventId,
  households,
}: {
  eventId: string;
  households: readonly GuestDialogHousehold[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        {t('guests.addGuest')}
      </Button>

      {/*
        `key` menja instancu pri svakom otvaranju, pa forma uvek kreće prazna -
        bez toga bi u njoj ostali podaci prethodno dodatog gosta.
      */}
      <GuestDialog
        key={open ? 'otvoren' : 'zatvoren'}
        eventId={eventId}
        households={households}
        open={open}
        onOpenChange={setOpen}
        guest={null}
      />
    </>
  );
}
