import { brand } from '@/config/brand';
import { rsvpLabels } from '@/features/rsvp/labels';
import { RsvpForm } from '@/features/rsvp/rsvp-form';
import { defaultRsvpSection } from '@/features/rsvp/section-data';
import type { LiveInteractionContext } from '@/features/rsvp/types';
import { splitAtRsvpSlot } from '@/lib/html-template/document';
import { getTranslations } from '@/i18n/server';
import type { PublicInvitation } from '@/server/services/public-invitation';

import { renderTemplateDocument } from './html-document';
import { ViewBeacon } from './view-beacon';

import '@/styles/invitation.css';
import '@/styles/html-invitation.css';

/**
 * Javni prikaz pozivnice napravljene od uvezenog sajta (zahtev 39.4).
 *
 * Sajt se ovde **ne** prevodi ni u šta - servira se onakav kakav je, sa svojim
 * stilovima i skriptama, u sopstvenom dokumentu (vidi layout grupe
 * `(pozivnica)`). Zbog toga animacije rade tačno kao kod autora.
 *
 * Dve stvari ipak nisu njegove:
 *
 * 1. **Vrednosti polja** - upisuju se na serveru, kroz `renderInvitationHtml`,
 *    gde svaka vrednost prolazi kroz bekstvovanje svog konteksta. Ništa što je
 *    organizator otkucao ne može da postane oznaka.
 * 2. **RSVP forma** - ukrasnu formu iz šablona uvoznik je zamenio praznim
 *    mestom, a ovde na to mesto ide prava forma platforme, ista ona koju koristi
 *    i pozivnica od sekcija.
 *
 * HTML se ubacuje kroz `dangerouslySetInnerHTML`, ali na **serveru**: pregledač
 * dobija običan HTML i parsira ga kao i svaki drugi, pa se skripte šablona
 * izvršavaju normalno. (Isto ubacivanje na klijentu ne bi pokrenulo nijednu
 * skriptu - zato pozivnica i ima svoj korenski layout, koji Next tera na tvrdu
 * navigaciju umesto na zamenu sadržaja.)
 */
export async function HtmlInvitationView({
  invitation,
  greetingName,
  live,
}: {
  invitation: PublicInvitation;
  greetingName: string | null;
  live: LiveInteractionContext | null;
}) {
  const t = await getTranslations(invitation.locale);

  if (invitation.html?.status !== 'ok') {
    return (
      <main className="pozivnica-rsvp">
        <h1 className="pozivnica-rsvp__title">
          {t('publicInvitation.notFoundTitle')}
        </h1>
        <p>{t('publicInvitation.notFoundText')}</p>
      </main>
    );
  }

  const parts = renderTemplateDocument({
    ...invitation.html,
    mediaUrl: (assetId) => invitation.context.media[assetId]?.url ?? null,
  });

  const slot = splitAtRsvpSlot(parts?.bodyHtml ?? '');

  return (
    <>
      <ViewBeacon slug={invitation.slug} />

      {greetingName ? (
        <p className="sr-only">
          {t('publicInvitation.greeting', { name: greetingName })}
        </p>
      ) : null}

      <div
        className="pozivnica-omotac"
        dangerouslySetInnerHTML={{ __html: slot.before }}
      />

      <section className="pozivnica-rsvp" id="rsvp" aria-labelledby="rsvp-naslov">
        <h2 className="pozivnica-rsvp__title" id="rsvp-naslov">
          {t('publicInvitation.rsvpTitle')}
        </h2>

        {live ? (
          <RsvpForm
            live={live}
            settings={defaultRsvpSection()}
            labels={rsvpLabels(invitation.locale)}
            index={0}
          />
        ) : null}
      </section>

      {slot.after === null ? null : (
        <div
          className="pozivnica-omotac"
          dangerouslySetInnerHTML={{ __html: slot.after }}
        />
      )}

      <p className="pozivnica-potpis">
        {/*
          Običan `<a>`, a ne `next/link`: pozivnica i ostatak aplikacije imaju
          različite korenske layout-e, pa je prelazak ionako puno učitavanje.
          `Link` bi ovde doneo ruter u stranicu koja inače nosi samo ono što joj
          treba (zahtev 39.10).
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/">{t('publicInvitation.poweredBy', { brand: brand.name })}</a>
      </p>
    </>
  );
}
