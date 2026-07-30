'use client';

import { Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslations } from '@/i18n/client';

export type PendingGuest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

/**
 * Podsetnik za goste koji nisu odgovorili (zahtev 5.10).
 *
 * Aplikacija namerno **ne** šalje poruke gostima sama. Kontakt gosta je dat
 * organizatoru za ovu proslavu, a ne nama za slanje - zato ovde stoji spisak
 * koji se kopira, a poruku šalje organizator svojim kanalom (zahtev 25).
 */
export function ReminderPanel({ guests }: { guests: readonly PendingGuest[] }) {
  const t = useTranslations();
  const [copied, setCopied] = useState<'email' | 'phone' | null>(null);

  const emails = guests.flatMap((guest) => (guest.email ? [guest.email] : []));
  const phones = guests.flatMap((guest) => (guest.phone ? [guest.phone] : []));
  const withoutContact = guests.length - new Set([...emails, ...phones]).size;

  if (guests.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('responses.remindersNone')}</p>;
  }

  const copy = (values: readonly string[], kind: 'email' | 'phone'): void => {
    void navigator.clipboard
      .writeText(values.join(', '))
      .then(() => setCopied(kind))
      .catch(() => setCopied(null));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('responses.remindersText')}</p>

      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {guests.map((guest) => (
          <li key={guest.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
            <span className="text-foreground">{guest.name}</span>
            {guest.email ? <span>{guest.email}</span> : null}
            {guest.phone ? <span>{guest.phone}</span> : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={emails.length === 0}
          onClick={() => copy(emails, 'email')}
        >
          <Copy aria-hidden />
          {copied === 'email'
            ? t('responses.remindersCopied')
            : t('responses.remindersCopyEmails')}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          disabled={phones.length === 0}
          onClick={() => copy(phones, 'phone')}
        >
          <Copy aria-hidden />
          {copied === 'phone'
            ? t('responses.remindersCopied')
            : t('responses.remindersCopyPhones')}
        </Button>
      </div>

      {withoutContact > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('responses.remindersNoContact', { count: withoutContact })}
        </p>
      ) : null}
    </div>
  );
}
