import type { ReactNode } from 'react';

import type { Locale } from '@/i18n/config';
import { prepareSectionsForRender } from '@/features/sections/migrate';
import { getSectionRenderer } from '@/features/sections/renderers';
import type {
  InvitationRenderContext,
  InvitationSectionRecord,
} from '@/features/sections/types';
import { themeDataAttributes, themeToCssVars } from '@/features/themes/css';
import type { ThemeTokens } from '@/features/themes/tokens';

/**
 * Sklapanje pozivnice od sekcija.
 *
 * Ista komponenta služi i demo stranici šablona, i pregledu u uređivaču, i
 * javnoj pozivnici - razliku pravi samo `context.mode`. Zbog toga demo ne može
 * da se "razidje" od onoga što gost stvarno vidi.
 *
 * Server komponenta: sekcije koje ne traže interakciju ne šalju nijedan bajt
 * JavaScripta (zahtev 32 i 39.10).
 */
export function InvitationRenderer({
  sections,
  theme,
  locale,
  context,
  className,
  children,
}: {
  sections: readonly InvitationSectionRecord[];
  theme: ThemeTokens;
  locale: Locale;
  context: InvitationRenderContext;
  className?: string;
  /**
   * Dodatni sloj unutar korena pozivnice (npr. uvodna animacija).
   *
   * Mora da bude **unutra** da bi nasledio CSS promenljive teme - uvod koji
   * koristi boje aplikacije umesto boja pozivnice deluje kao tuđi ekran.
   */
  children?: ReactNode;
}) {
  // Nevalidne i nepoznate sekcije se preskaču, a ne ruše stranicu: gost mora da
  // vidi pozivnicu i kada je jedna sekcija oštećena.
  const prepared = prepareSectionsForRender(sections, (sectionId, error) => {
    console.warn(`[pozivnica] Sekcija ${sectionId} je preskočena: ${error}`);
  });

  return (
    <div
      className={className ? `invitation-root ${className}` : 'invitation-root'}
      style={themeToCssVars(theme)}
      {...themeDataAttributes(theme)}
      lang={locale === 'sr-Cyrl' ? 'sr-Cyrl' : locale}
    >
      {prepared.map((section, index) => {
        const Renderer = getSectionRenderer(section.type);
        if (!Renderer) return null;

        return (
          <Renderer
            key={section.id}
            data={section.data}
            theme={theme}
            locale={locale}
            index={index}
            event={context}
          />
        );
      })}

      {children}
    </div>
  );
}
