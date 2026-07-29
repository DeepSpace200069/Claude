import type { Metadata } from 'next';
import { cookies } from 'next/headers';

import { brand, appUrl } from '@/config/brand';
import { PublicInvitationView } from '@/features/invitations/public-invitation-view';
import { InvitationUnavailable } from '@/features/invitations/unavailable';
import { getTranslations } from '@/i18n/server';
import { pinCookieName } from '@/features/invitations/pin-cookie';
import {
  getPublicInvitation,
  resolvePublicAccess,
} from '@/server/services/public-invitation';

type Params = { publicSlug: string };

/**
 * Javna pozivnica (zahtev 21, 22 i 23).
 *
 * Stranica je dinamička jer zavisi od kolačića (PIN) i od trenutka (istek), ali
 * je sam sadržaj pozivnice keširan i poništava se pri svakoj izmeni - težak deo
 * posla se zato ne ponavlja za svakog gosta (zahtev 4.7).
 */

/**
 * Metapodaci i kartica pri deljenju (zahtev 16 i 4.4).
 *
 * Ono što se sme prikazati zavisi od privatnosti. Zaštićena pozivnica ne sme da
 * oda imena mladenaca u pregledu linka - ko nema PIN, ne treba ni iz kartice da
 * sazna ono što stranica krije.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { publicSlug } = await params;
  const invitation = await getPublicInvitation(publicSlug);
  const t = await getTranslations(invitation?.locale);

  const canonical = appUrl(`/p/${publicSlug}`);

  if (!invitation || invitation.status !== 'published') {
    return {
      title: t('publicInvitation.notFoundTitle'),
      robots: { index: false, follow: false },
      alternates: { canonical },
    };
  }

  const isProtected =
    invitation.privacy === 'pin' || invitation.privacy === 'invite_only';

  const title = isProtected
    ? t('publicInvitation.pinTitle')
    : invitation.share.title || invitation.title || brand.name;

  const description = isProtected
    ? t('publicInvitation.pinText')
    : invitation.share.description || invitation.summary || undefined;

  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical },
    /*
     * Indeksiranje je dozvoljeno samo u režimu „javno". Sve ostalo je
     * `noindex` - podrazumevano stanje pozivnice je da se ne pojavljuje u
     * pretraživačima (zahtev 23).
     */
    robots:
      invitation.privacy === 'public'
        ? { index: true, follow: true }
        : { index: false, follow: false },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      ...(description ? { description } : {}),
      siteName: brand.name,
      ...(isProtected || !invitation.share.imageUrl
        ? {}
        : { images: [{ url: invitation.share.imageUrl }] }),
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function PublicInvitationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { publicSlug } = await params;

  const store = await cookies();
  const access = await resolvePublicAccess({
    slug: publicSlug,
    pinProof: store.get(pinCookieName(publicSlug))?.value ?? null,
  });

  if (access.state === 'ok') {
    return (
      <PublicInvitationView
        invitation={access.invitation}
        greetingName={access.greetingName}
      />
    );
  }

  return <InvitationUnavailable state={access} slug={publicSlug} />;
}
