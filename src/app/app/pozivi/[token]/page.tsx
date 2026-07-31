import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { getRequestLocale, getTranslations } from '@/i18n/server';
import { requireUserPage } from '@/server/authz/page-guards';
import { acceptInvite } from '@/server/services/collaborators';

/**
 * Prihvatanje poziva za saradnju (zahtev 25).
 *
 * Poziv se prihvata **otvaranjem linka iz mejla**, ali tek pošto je korisnik
 * prijavljen: bez prijave nema naloga na koji bi se pristup vezao. Zato
 * neprijavljen posetilac ide na prijavu sa `callbackUrl` na ovu istu stranicu.
 *
 * Token se troši prihvatanjem, pa se prosleđen link ne može iskoristiti dvaput.
 */
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await requireUserPage(`/app/pozivi/${token}`);

  const result = await acceptInvite(token, { id: user.id, email: user.email });

  if (result.state === 'ok') {
    // Prihvaćen poziv nema šta da prikaže - korisnik ide pravo na događaj.
    redirect(`/app/dogadjaji/${result.eventId}`);
  }

  const locale = await getRequestLocale();
  const t = await getTranslations(locale);

  const message =
    result.state === 'expired'
      ? t('collaborators.inviteExpired')
      : result.state === 'wrong_account'
        ? t('collaborators.inviteWrongAccount', { email: result.invitedEmail })
        : t('collaborators.inviteInvalid');

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('collaborators.inviteTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="warning">{message}</Alert>
          <Button asChild variant="secondary">
            <Link href="/app/dogadjaji">{t('nav.events')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
