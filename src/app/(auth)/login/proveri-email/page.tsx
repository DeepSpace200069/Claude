import { MailCheck } from 'lucide-react';
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

/** Potvrda da je magic link poslat. */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const t = await getTranslations();
  const { email } = await searchParams;

  return (
    <Card className="animate-fade-up text-center">
      <CardHeader className="items-center">
        <span className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <CardTitle className="font-display text-2xl">
          {t('auth.magicLinkSentTitle')}
        </CardTitle>
        <CardDescription>
          {t('auth.magicLinkSentText', { email: email ?? t('auth.emailLabel') })}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">{t('common.back')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
