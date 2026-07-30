import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { brand } from '@/config/brand';
import { InvitationUnavailable } from '@/features/invitations/unavailable';
import { PublicInvitationView } from '@/features/invitations/public-invitation-view';
import { pinCookieName } from '@/features/invitations/pin-cookie';
import { InvitationNotice } from '@/features/invitations/notice-page';
import { getTranslations } from '@/i18n/server';
import { buildLiveContext } from '@/server/services/live-context';
import { resolvePublicAccess } from '@/server/services/public-invitation';
import { loadResponseByEditToken } from '@/server/services/rsvp';

type Params = { publicSlug: string; editToken: string };

/**
 * Izmena već poslatog odgovora (zahtev 5, gost).
 *
 * Gost nema nalog, pa je token iz linka jedini dokaz da menja **svoj** odgovor.
 * Zato se traži po hešu i uvek u okviru jedne pozivnice, a stranica se nikad ne
 * indeksira - link u istoriji pregledača ne sme da završi u pretraživaču.
 */
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function EditResponsePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { publicSlug, editToken } = await params;

  const store = await cookies();
  const access = await resolvePublicAccess({
    slug: publicSlug,
    pinProof: store.get(pinCookieName(publicSlug))?.value ?? null,
  });

  if (access.state !== 'ok') {
    return <InvitationUnavailable state={access} slug={publicSlug} />;
  }

  const existing = await loadResponseByEditToken(
    access.invitation.invitationId,
    editToken,
  );

  if (!existing) {
    const t = await getTranslations(access.invitation.locale);
    return (
      <InvitationNotice
        title={t('publicInvitation.editLinkInvalidTitle')}
        text={t('publicInvitation.editLinkInvalidText')}
        footerLabel={t('publicInvitation.backHome', { brand: brand.name })}
      />
    );
  }

  const live = await buildLiveContext({
    invitation: access.invitation,
    editToken,
  });

  return (
    <PublicInvitationView
      invitation={access.invitation}
      greetingName={existing.fullName}
      live={live}
    />
  );
}
