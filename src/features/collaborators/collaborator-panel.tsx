'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';

import { COLLABORATOR_ROLES } from './schemas';

type Role = (typeof COLLABORATOR_ROLES)[number];

export type CollaboratorView = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: 'pending' | 'accepted' | 'revoked';
};

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Pozivanje i upravljanje saradnicima (zahtev 25).
 *
 * Akcije stižu kao props. Kada paket ne uključuje saradnike, forma ostaje
 * vidljiva i **onemogućena** uz razlog - sakrivena forma ne objašnjava ništa, a
 * server bi zahtev ionako odbio.
 */
export function CollaboratorPanel({
  eventId,
  collaborators,
  canInvite,
  planName,
  billingHref,
  invite,
  changeRole,
  revoke,
}: {
  eventId: string;
  collaborators: CollaboratorView[];
  canInvite: boolean;
  planName: string;
  billingHref: string;
  invite: (input: {
    eventId: string;
    email: string;
    role: Role;
  }) => Promise<ActionResult<{ emailSent: boolean }>>;
  changeRole: (input: {
    eventId: string;
    collaboratorId: string;
    role: Role;
  }) => Promise<ActionResult<null>>;
  revoke: (input: {
    eventId: string;
    collaboratorId: string;
  }) => Promise<ActionResult<null>>;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roleLabel = (value: Role): string =>
    value === 'editor'
      ? t('collaborators.roleEditor')
      : value === 'guest_manager'
        ? t('collaborators.roleGuestManager')
        : t('collaborators.roleViewer');

  const onInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(null);

    const result = await invite({ eventId, email, role });
    setBusy(false);

    if (!result.ok) {
      const emailError = result.fieldErrors?.email?.[0];
      setFieldError(emailError ?? null);
      setError(emailError ? null : result.message);
      return;
    }

    setEmail('');
    // Poruka razlikuje poslat mejl od zapisanog poziva: ako mejl nije prošao,
    // korisnik mora da zna da poziv postoji, ali da ga treba poslati ponovo.
    toast.success(
      result.data.emailSent
        ? t('collaborators.invited')
        : t('collaborators.invitedNoEmail'),
    );
    router.refresh();
  };

  const runRoleChange = async (collaboratorId: string, next: Role) => {
    const result = await changeRole({ eventId, collaboratorId, role: next });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(t('common.saved'));
    router.refresh();
  };

  const active = collaborators.filter((row) => row.status !== 'revoked');

  return (
    <div className="space-y-6">
      {!canInvite ? (
        <Alert tone="info" title={t('collaborators.planLockedTitle')}>
          <p>{t('collaborators.planLockedText', { plan: planName })}</p>
          <p className="mt-2">
            <a href={billingHref} className="font-medium underline underline-offset-4">
              {t('collaborators.seePlans')}
            </a>
          </p>
        </Alert>
      ) : null}

      <form onSubmit={(event) => void onInvite(event)} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field
            label={t('collaborators.emailLabel')}
            hint={t('collaborators.emailHint')}
            error={fieldError ?? undefined}
            required
          >
            <FieldControl>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  type="email"
                  value={email}
                  disabled={!canInvite}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="off"
                />
              )}
            </FieldControl>
          </Field>

          <Field label={t('collaborators.roleLabel')}>
            <FieldControl>
              {(controlProps) => (
                <Select
                  value={role}
                  disabled={!canInvite}
                  onValueChange={(next) => setRole(next as Role)}
                >
                  <SelectTrigger id={controlProps.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLABORATOR_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {roleLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FieldControl>
          </Field>
        </div>

        <Button type="submit" loading={busy} disabled={!canInvite}>
          <UserPlus aria-hidden />
          {t('collaborators.invite')}
        </Button>
      </form>

      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('collaborators.empty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {active.map((collaborator) => (
            <li
              key={collaborator.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <span className="min-w-0">
                <span className="block font-medium">
                  {collaborator.name ?? collaborator.email}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {collaborator.email}
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-3">
                <Badge
                  variant={collaborator.status === 'accepted' ? 'success' : 'warning'}
                >
                  {collaborator.status === 'accepted'
                    ? t('collaborators.statusAccepted')
                    : t('collaborators.statusPending')}
                </Badge>

                <Select
                  value={collaborator.role}
                  onValueChange={(next) =>
                    void runRoleChange(collaborator.id, next as Role)
                  }
                >
                  <SelectTrigger
                    className="h-9 w-44"
                    aria-label={t('collaborators.roleLabel')}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLABORATOR_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {roleLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="ghost" size="sm">
                      {t('collaborators.revoke')}
                    </Button>
                  }
                  title={t('collaborators.revokeTitle')}
                  description={t('collaborators.revokeText', {
                    email: collaborator.email,
                  })}
                  confirmLabel={t('collaborators.revoke')}
                  cancelLabel={t('common.cancel')}
                  onConfirm={async () => {
                    const result = await revoke({
                      eventId,
                      collaboratorId: collaborator.id,
                    });
                    if (!result.ok) return result.message;
                    toast.success(t('collaborators.revoked'));
                    router.refresh();
                    return null;
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
