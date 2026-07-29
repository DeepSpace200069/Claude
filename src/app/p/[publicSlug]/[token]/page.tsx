import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PublicInvitationView } from '@/features/invitations/public-invitation-view';
import { InvitationUnavailable } from '@/features/invitations/unavailable';
import { pinCookieName } from '@/features/invitations/pin-cookie';
import { resolvePublicAccess } from '@/server/services/public-invitation';

type Params = { publicSlug: string; token: string };

/**
 * Personalizovani link gosta (zahtev 12 i 23).
 *
 * Token je jedini nosilac pristupa u režimu „samo lični linkovi", pa se stranica
 * **nikad** ne indeksira i nikad ne opisuje sadržaj u kartici deljenja: link
 * prosleđen dalje ne sme da otkrije ni kome je poslat ni šta sadrži.
 *
 * Sama RSVP forma vezana za ovaj token dolazi u Fazi 5; ovde token služi za
 * pristup i za pozdrav po imenu.
 */
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function RecipientInvitationPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { publicSlug, token } = await params;

  const store = await cookies();
  const access = await resolvePublicAccess({
    slug: publicSlug,
    recipientToken: token,
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

  /*
   * Pozivnica zaštićena PIN-om, a token nije njen: gost ide na običan link, gde
   * ga čeka kapija za PIN. Bolje nego poruka „link nije ispravan" nekome ko je
   * možda samo prekopirao stariji link.
   */
  if (access.state === 'pin_required') {
    redirect(`/p/${publicSlug}`);
  }

  return <InvitationUnavailable state={access} slug={publicSlug} />;
}
