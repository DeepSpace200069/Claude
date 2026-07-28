'use client';

import { Toaster as SonnerToaster } from 'sonner';

/**
 * Prolazna obaveštenja (zahtev 30).
 *
 * `richColors` je isključen jer koristimo sopstvene semantičke tokene, a
 * `closeButton` je uključen da poruka ne bi nestala pre nego što je korisnik
 * pročita.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      duration={5000}
      toastOptions={{
        classNames: {
          toast:
            'rounded-[var(--radius)] border border-border bg-surface text-surface-foreground shadow-lifted',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
          error: 'border-destructive/30',
          success: 'border-success/30',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
