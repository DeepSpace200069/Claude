import { InvitationRenderer } from '@/features/invitations/invitation-renderer';
import { getSectionDefinition } from '@/features/sections/registry';
import { brand } from '@/config/brand';
import { getTranslations } from '@/i18n/server';
import type { PublicInvitation } from '@/server/services/public-invitation';

import { IntroOverlay } from './intro-overlay';
import { InvitationFooterBranding } from './notice-page';
import { ViewBeacon } from './view-beacon';

import '@/styles/invitation.css';

/**
 * Javni prikaz pozivnice (zahtev 21, 22 i 39.10).
 *
 * Server komponenta. Ceo sadržaj stiže kao HTML, a JavaScript nose samo tri
 * sitnice koje bez njega ne mogu: uvodna animacija, prijava pregleda i one
 * sekcije koje su i inače interaktivne (odbrojavanje, galerija, muzika).
 * Uređivač se ovde **ne** uvozi ni posredno.
 */
export async function PublicInvitationView({
  invitation,
  greetingName,
}: {
  invitation: PublicInvitation;
  greetingName: string | null;
}) {
  // Pozivnica se prikazuje na jeziku koji je organizator izabrao za događaj, a
  // ne na jeziku pregledača gosta: tekst koji je organizator uneo i okvir oko
  // njega moraju da budu na istom jeziku.
  const t = await getTranslations(invitation.locale);

  const hero = invitation.document.sections.find(
    (section) => section.type === 'hero' && section.isVisible,
  );
  const showIntro =
    hero !== undefined &&
    getSectionDefinition('hero') !== undefined &&
    (hero.data as { showIntroAnimation?: boolean }).showIntroAnimation === true;

  const introTitle =
    (hero?.data as { title?: string } | undefined)?.title?.trim() ||
    invitation.title;

  return (
    <>
      <ViewBeacon slug={invitation.slug} />

      <main id="glavni-sadrzaj">
        {greetingName ? (
          <p className="sr-only">
            {t('publicInvitation.greeting', { name: greetingName })}
          </p>
        ) : null}

        <InvitationRenderer
          sections={invitation.document.sections}
          theme={invitation.document.theme}
          locale={invitation.locale}
          context={invitation.context}
        >
          {showIntro ? (
            <IntroOverlay
              title={introTitle}
              skipLabel={t('publicInvitation.skipIntro')}
            />
          ) : null}
        </InvitationRenderer>
      </main>

      <InvitationFooterBranding
        label={t('publicInvitation.poweredBy', { brand: brand.name })}
      />
    </>
  );
}
