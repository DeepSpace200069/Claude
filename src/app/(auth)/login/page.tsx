import type { Metadata } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/features/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { loadMessages } from '@/i18n/messages';
import { isGoogleEnabled } from '@/server/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t('auth.loginTitle'), robots: { index: false, follow: false } };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const locale = await getRequestLocale();
  const t = await getTranslations(locale);
  const messages = await loadMessages(locale);
  const { callbackUrl } = await searchParams;

  return (
    <Card className="animate-fade-up">
      <CardHeader>
        <CardTitle className="font-display text-2xl">{t('auth.loginTitle')}</CardTitle>
        <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        <LoginForm
          locale={locale}
          messages={{ auth: messages.auth, common: messages.common }}
          googleEnabled={isGoogleEnabled()}
          callbackUrl={sanitizeCallbackUrl(callbackUrl)}
        />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/uslovi-koriscenja" className="underline underline-offset-4">
            {t('nav.terms')}
          </Link>
          {' · '}
          <Link href="/politika-privatnosti" className="underline underline-offset-4">
            {t('nav.privacy')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Dozvoljava samo relativne putanje kao odredište posle prijave.
 *
 * Bez ove provere `?callbackUrl=https://napadac.example` bi pretvorio stranicu
 * prijave u otvoreno preusmerenje.
 */
function sanitizeCallbackUrl(value: string | undefined): string {
  if (!value) return '/app/dogadjaji';
  if (!value.startsWith('/') || value.startsWith('//')) return '/app/dogadjaji';
  return value;
}
