'use client';

import { Link2, Link2Off, Pencil, Trash2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import {
  deleteGuestAction,
  issueRecipientLinkAction,
  revokeRecipientLinkAction,
} from '@/server/actions/guests';

import { GuestDialog, type GuestDialogHousehold } from './guest-dialog';
import { IssuedLinkDialog } from './issued-link-dialog';
import { tagsToText } from './schemas';

export type GuestListItem = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  isChild: boolean;
  tags: string[];
  privateNote: string | null;
  householdId: string | null;
  householdName: string | null;
  rsvpStatus: 'pending' | 'yes' | 'no' | 'maybe' | null;
  recipientId: string | null;
  hasLink: boolean;
};

/**
 * Spisak gostiju (zahtev 12 i 13).
 *
 * Na širokom ekranu je tabela, na telefonu niz kartica - ista lista, jedan
 * izvor podataka. Privatna beleška se prikazuje diskretno, ispod imena: to je
 * podatak koji organizator gleda dok zove goste, a gost ga nikad ne vidi.
 */
export function GuestTable({
  eventId,
  guests,
  households,
}: {
  eventId: string;
  guests: readonly GuestListItem[];
  households: readonly GuestDialogHousehold[];
}) {
  const t = useTranslations();
  const router = useRouter();

  const [editing, setEditing] = useState<GuestListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [issuedLink, setIssuedLink] = useState<string | null>(null);

  const issueLink = async (guest: GuestListItem): Promise<void> => {
    const result = await issueRecipientLinkAction({
      eventId,
      guestId: guest.id,
      householdId: '',
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setIssuedLink(result.data.url);
    router.refresh();
  };

  if (guests.length === 0) {
    return (
      <EmptyState
        icon={<UserRound aria-hidden />}
        title={t('guests.emptyTitle')}
        description={t('guests.emptyText')}
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <caption className="sr-only">{t('guests.title')}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 font-medium">
                {t('guests.columnName')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('guests.columnContact')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('guests.columnHousehold')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('guests.columnResponse')}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t('guests.columnLink')}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t('guests.columnActions')}
              </th>
            </tr>
          </thead>

          <tbody>
            {guests.map((guest) => (
              <tr key={guest.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 align-top">
                  <div className="font-medium">
                    {[guest.firstName, guest.lastName].filter(Boolean).join(' ')}
                    {guest.isChild ? (
                      <Badge variant="neutral" className="ml-2">
                        {t('guests.isChild')}
                      </Badge>
                    ) : null}
                  </div>

                  {guest.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {guest.tags.map((tag) => (
                        <Badge key={tag} variant="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  {guest.privateNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {guest.privateNote}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3 align-top text-muted-foreground">
                  {guest.email ? <div>{guest.email}</div> : null}
                  {guest.phone ? <div>{guest.phone}</div> : null}
                  {!guest.email && !guest.phone ? <span aria-hidden>—</span> : null}
                </td>

                <td className="px-4 py-3 align-top text-muted-foreground">
                  {guest.householdName ?? <span aria-hidden>—</span>}
                </td>

                <td className="px-4 py-3 align-top">
                  <ResponseBadge status={guest.rsvpStatus} />
                </td>

                <td className="px-4 py-3 align-top">
                  {guest.hasLink ? (
                    <span className="text-xs text-muted-foreground">
                      {t('guests.linkActive')}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t('guests.linkNone')}
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 align-top">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void issueLink(guest)}
                    >
                      <Link2 aria-hidden />
                      {guest.hasLink ? t('guests.reissueLink') : t('guests.issueLink')}
                    </Button>

                    {guest.hasLink && guest.recipientId ? (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm">
                            <Link2Off aria-hidden />
                            <span className="sr-only">{t('guests.revokeLink')}</span>
                          </Button>
                        }
                        title={t('guests.revokeLink')}
                        description={t('guests.revokeConfirm')}
                        confirmLabel={t('guests.revokeLink')}
                        cancelLabel={t('common.cancel')}
                        onConfirm={async () => {
                          const result = await revokeRecipientLinkAction({
                            eventId,
                            recipientId: guest.recipientId as string,
                          });
                          if (!result.ok) return result.message;
                          toast.success(t('guests.linkRevoked'));
                          router.refresh();
                          return null;
                        }}
                      />
                    ) : null}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(guest);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil aria-hidden />
                      <span className="sr-only">{t('guests.editGuest')}</span>
                    </Button>

                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Trash2 aria-hidden />
                          <span className="sr-only">{t('guests.deleteGuest')}</span>
                        </Button>
                      }
                      title={t('guests.deleteGuest')}
                      description={t('guests.deleteConfirm', {
                        name: [guest.firstName, guest.lastName]
                          .filter(Boolean)
                          .join(' '),
                      })}
                      confirmLabel={t('common.delete')}
                      cancelLabel={t('common.cancel')}
                      onConfirm={async () => {
                        const result = await deleteGuestAction({
                          eventId,
                          guestId: guest.id,
                        });
                        if (!result.ok) return result.message;
                        toast.success(t('guests.deleted'));
                        router.refresh();
                        return null;
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <GuestDialog
          key={editing.id}
          eventId={eventId}
          households={households}
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          guest={{
            id: editing.id,
            firstName: editing.firstName,
            lastName: editing.lastName ?? '',
            email: editing.email ?? '',
            phone: editing.phone ?? '',
            isChild: editing.isChild,
            privateNote: editing.privateNote ?? '',
            householdId: editing.householdId ?? '',
            tagsText: tagsToText(editing.tags),
          }}
        />
      ) : null}

      <IssuedLinkDialog url={issuedLink} onClose={() => setIssuedLink(null)} />
    </>
  );
}

function ResponseBadge({
  status,
}: {
  status: 'pending' | 'yes' | 'no' | 'maybe' | null;
}) {
  const t = useTranslations();

  if (status === 'yes') {
    return <Badge variant="success">{t('guests.responseYes')}</Badge>;
  }
  if (status === 'no') {
    return <Badge variant="neutral">{t('guests.responseNo')}</Badge>;
  }
  if (status === 'maybe') {
    return <Badge variant="warning">{t('guests.responseMaybe')}</Badge>;
  }
  return <Badge variant="neutral">{t('guests.responsePending')}</Badge>;
}
