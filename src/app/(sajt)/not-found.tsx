import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { getTranslations } from '@/i18n/server';

/** Stranica nije pronađena. */
export default async function NotFound() {
  const t = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-6xl font-semibold text-primary">404</p>
      <h1 className="mt-4 font-display text-2xl font-semibold">
        {t('errors.notFoundTitle')}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t('errors.notFoundText')}</p>
      <Button asChild className="mt-8">
        <Link href="/">{t('errors.backHome')}</Link>
      </Button>
    </div>
  );
}
