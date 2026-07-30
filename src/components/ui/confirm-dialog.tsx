'use client';

import { useState, type ReactNode } from 'react';

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
import { Alert } from '@/components/ui/feedback';

/**
 * Potvrda pre radnje koja se ne poništava lako.
 *
 * Namerno **nije** `window.confirm`: sistemski dijalog ne poštuje jezik
 * aplikacije, ne može da objasni posledicu i na telefonu izgleda kao greška
 * stranice. Ovaj čeka odgovor servera pre zatvaranja, pa poruka o grešci ostaje
 * vidljiva umesto da nestane sa dijalogom (zahtev 30).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  /** Vraća poruku greške, ili `null` kada je radnja uspela. */
  onConfirm: () => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent closeLabel={cancelLabel}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'primary'}
            loading={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const message = await onConfirm();
              setPending(false);

              if (message) {
                setError(message);
                return;
              }
              setOpen(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
