import type { Metadata } from 'next';
import { after } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { PublicInvitationView } from '@/features/invitations/public-invitation-view';
import { InvitationUnavailable } from '@/features/invitations/unavailable';
import { pinCookieName } from '@/features/invitations/pin-cookie';
import { buildLiveContext } from '@/server/services/live-context';
import { resolvePublicAccess } from '@/server/services/public-invitation';
import { findRecipientByToken, recordRecipientOpen } from '@/server/services/rsvp';

type Params = { publicSlug: string; token: string };

/**
 * Personalizovani link gosta (zahtev 12, 13 i 23).
 *
 * Token je jedini nosilac pristupa u režimu „samo lični linkovi", pa se stranica
 * **nikad** ne indeksira i nikad ne opisuje sadržaj u kartici deljenja: link
 * prosleđen dalje ne sme da otkrije ni kome je poslat ni šta sadrži.
 *
 * Uz token gost dobija pozdrav po imenu i RSVP formu koja već zna ko je - a ako
 * je ranije odgovorio, i njegov raniji odgovor, spreman za izmenu.
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
    const live = await buildLiveContext({
      invitation: access.invitation,
      recipientToken: token,
    });

    /*
     * Brojanje otvaranja ide posle odgovora (`after`): gost ne treba da čeka
     * upis u bazu da bi video pozivnicu, a organizatoru je „ko još nije ni
     * otvorio" najkorisniji podatak pred slanje podsetnika.
     */
    after(async () => {
      const recipient = await findRecipientByToken(access.invitation.invitationId, token);
      if (recipient) await recordRecipientOpen(recipient.id);
    });

    return (
      <PublicInvitationView
        invitation={access.invitation}
        greetingName={access.greetingName}
        live={live}
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
