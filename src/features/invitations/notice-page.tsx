import Link from 'next/link';
import type { ReactNode } from 'react';

import { brand } from '@/config/brand';

/**
 * Ekran umesto pozivnice: istekla, isključena, samo za lične linkove, nije nađena.
 *
 * Namerno je pristojan i konkretan. Gost koji je dobio link nije pogrešio ništa
 * i ne zanima ga HTTP status - zanima ga šta sada da radi, pa svaka poruka to i
 * kaže. Sadržaj pozivnice se ovde nikad ne prikazuje, ni delimično.
 */
export function InvitationNotice({
  title,
  text,
  footerLabel,
  children,
}: {
  title: string;
  text: string;
  footerLabel: string;
  children?: ReactNode;
}) {
  return (
    <main
      id="glavni-sadrzaj"
      className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center"
    >
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{text}</p>
        {children}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          {footerLabel}
        </Link>
      </p>
    </main>
  );
}

/** Sitan potpis na dnu objavljene pozivnice; uklanja ga paket bez brendinga. */
export function InvitationFooterBranding({ label }: { label: string }) {
  return (
    <p className="bg-background px-6 py-6 text-center text-xs text-muted-foreground">
      <Link href="/" className="underline-offset-4 hover:underline">
        {label.replace('{brand}', brand.name)}
      </Link>
    </p>
  );
}
