'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';

/**
 * Male administrativne kontrole (zahtev 19).
 *
 * Sve primaju serversku akciju kao prop, a ne uvozom: tako serverski graf ne
 * ulazi u klijentski bundle. Svaka radnja je i na serveru zaštićena
 * `requireAdmin()`, pa onemogućeno dugme nigde nije jedina odbrana.
 */

export type AdminActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

type AdminAction = (input: Record<string, unknown>) => Promise<AdminActionResult>;

/** Promena uloge korisnika; radnja se izvršava odmah po izboru. */
export function RoleSelect({
  userId,
  role,
  disabled,
  setRole,
}: {
  userId: string;
  role: 'user' | 'admin';
  disabled: boolean;
  setRole: AdminAction;
}) {
  const t = useTranslations();
  const [value, setValue] = useState(role);
  const [busy, setBusy] = useState(false);

  const onChange = async (next: string) => {
    const nextRole = next === 'admin' ? 'admin' : 'user';
    const previous = value;

    setValue(nextRole);
    setBusy(true);
    const result = await setRole({ userId, role: nextRole });
    setBusy(false);

    if (!result.ok) {
      // Vraćanje na staru vrednost: prikaz ne sme da tvrdi nešto što server nije prihvatio.
      setValue(previous);
      toast.error(result.message);
      return;
    }

    toast.success(t('admin.roleChanged'));
  };

  return (
    <Select
      value={value}
      disabled={disabled || busy}
      onValueChange={(next) => void onChange(next)}
    >
      <SelectTrigger className="h-9 w-44" aria-label={t('admin.usersRole')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">{t('admin.roleUser')}</SelectItem>
        <SelectItem value="admin">{t('admin.roleAdmin')}</SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Ručna aktivacija narudžbine.
 *
 * Razlog je obavezan i završava u audit logu - besplatna aktivacija bez traga
 * je rupa u evidenciji naplate.
 */
export function ActivateOrderDialog({
  orderId,
  activate,
}: {
  orderId: string;
  activate: AdminAction;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    setBusy(true);
    setError(null);

    const result = await activate({ orderId, reason });
    setBusy(false);

    if (!result.ok) {
      setError(result.fieldErrors?.reason?.[0] ?? result.message);
      return;
    }

    setOpen(false);
    setReason('');
    toast.success(t('admin.ordersActivated'));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          {t('admin.ordersActivate')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.ordersActivateTitle')}</DialogTitle>
          <DialogDescription>{t('admin.ordersActivateText')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field
            label={t('admin.ordersReasonLabel')}
            hint={t('admin.ordersReasonHint')}
            required
          >
            <FieldControl>
              {(controlProps) => (
                <Input
                  {...controlProps}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>
        </div>

        <DialogFooter>
          <Button type="button" loading={busy} onClick={() => void onConfirm()}>
            {t('admin.ordersActivate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dugme koje pokreće akciju i prijavljuje ishod porukom. */
export function AdminActionButton({
  label,
  successMessage,
  input,
  action,
  disabled,
  variant = 'secondary',
  confirm,
}: {
  label: string;
  successMessage: string;
  input: Record<string, unknown>;
  action: AdminAction;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Kada je zadato, radnja traži potvrdu u dijalogu. */
  confirm?: { title: string; description: string; cancelLabel: string };
}) {
  const [busy, setBusy] = useState(false);

  const run = async (): Promise<string | null> => {
    const result = await action(input);
    if (!result.ok) return result.message;
    toast.success(successMessage);
    return null;
  };

  if (confirm) {
    return (
      <ConfirmDialog
        trigger={
          <Button type="button" variant={variant} size="sm" disabled={disabled}>
            {label}
          </Button>
        }
        title={confirm.title}
        description={confirm.description}
        confirmLabel={label}
        cancelLabel={confirm.cancelLabel}
        destructive={false}
        onConfirm={run}
      />
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      loading={busy}
      disabled={disabled}
      onClick={async () => {
        setBusy(true);
        const error = await run();
        setBusy(false);
        if (error) toast.error(error);
      }}
    >
      {label}
    </Button>
  );
}
