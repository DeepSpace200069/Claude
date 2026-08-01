import { TriangleAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getTranslations } from '@/i18n/server';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Greška pri prijavi.
 *
 * Auth.js prosleđuje kod greške; prevodimo samo kodove koje korisnik može da
 * reši, sve ostalo dobija generičku poruku da ne bismo otkrivali detalje.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations();
  const { error } = await searchParams;

  const message =
    error === 'Verification'
      ? t('auth.errorExpiredLink')
      : error === 'AccessDenied'
        ? t('auth.errorAccessDenied')
        : t('auth.errorGeneric');

  return (
    <Card className="animate-fade-up text-center">
      <CardHeader className="items-center">
        <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-destructive-subtle text-destructive">
          <TriangleAlert className="size-6" aria-hidden />
        </span>
        <CardTitle className="font-display text-2xl">{t('auth.errorTitle')}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>

      <CardContent>
        <Button asChild className="w-full">
          <Link href="/login">{t('common.retry')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
