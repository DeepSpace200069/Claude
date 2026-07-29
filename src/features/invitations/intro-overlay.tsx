'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

/**
 * Uvodna animacija pozivnice (zahtev 22 i 4.8).
 *
 * Sloj se povlači **sam, preko CSS animacije** - ne čeka JavaScript. Zbog toga
 * gost kome skripta ne stigne ili je blokirana nikad ne ostane zarobljen iza
 * uvoda: animacija završi u `visibility: hidden` i pozivnica je tu.
 *
 * `prefers-reduced-motion` je pokriven u samom CSS-u, pa se uvod ne prikaže
 * nijednom trenutku ako je gost isključio animacije u sistemu.
 *
 * Preskakanje postoji u dva oblika: klik bilo gde po sloju i taster `Esc`.
 * Vidljivo dugme „preskoči" se učitava **samo uz JavaScript** - dugme koje ne
 * može da odradi svoj posao ne treba ni da postoji na ekranu.
 */
const SKIPPED_ATTRIBUTE = 'data-uvod';

function skipIntro(): void {
  document.documentElement.setAttribute(SKIPPED_ATTRIBUTE, 'preskocen');
}

const IntroSkipButton = dynamic(
  () => import('./intro-skip-button').then((module) => module.IntroSkipButton),
  { ssr: false },
);

export function IntroOverlay({
  title,
  skipLabel,
}: {
  title: string;
  skipLabel: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skipIntro();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    // `aria-hidden`: za čitač ekrana pozivnica počinje od prve prave sekcije,
    // a ne od dekorativnog uvoda.
    <div className="inv-intro" aria-hidden onClick={skipIntro}>
      <p className="inv-intro__title">{title}</p>
      <IntroSkipButton label={skipLabel} onSkip={skipIntro} />
    </div>
  );
}
