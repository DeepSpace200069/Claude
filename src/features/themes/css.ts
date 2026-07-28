import type { CSSProperties } from 'react';

import type { ThemeTokens } from './tokens';

/**
 * Prevođenje tokena teme u CSS promenljive (zahtev 10).
 *
 * Tokeni se ubrizgavaju kao inline `style` na korenu pozivnice, a ne kao
 * globalne klase: na jednoj stranici može da postoji više pozivnica sa
 * različitim temama (galerija šablona, uporedni pregled), i nijedna tema ne sme
 * da "procuri" u aplikaciju oko sebe.
 */

/** Font parovi; svaki definiše naslovni i tekstualni stek. */
const FONT_PAIRS: Record<
  ThemeTokens['fontPair'],
  { display: string; body: string }
> = {
  'serif-editorial': {
    display: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
    body: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
  },
  'serif-romantic': {
    display: "'Didot', 'Bodoni MT', 'Playfair Display', Georgia, serif",
    body: "Georgia, 'Times New Roman', serif",
  },
  'sans-modern': {
    display:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    body: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  'sans-geometric': {
    display: "'Futura', 'Century Gothic', 'Avenir Next', ui-sans-serif, sans-serif",
    body: "'Avenir Next', ui-sans-serif, system-ui, sans-serif",
  },
  'mixed-classic': {
    display: "'Didot', 'Bodoni MT', Georgia, serif",
    body: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  'display-playful': {
    display: "'Marker Felt', 'Comic Sans MS', 'Chalkboard SE', cursive",
    body: "ui-rounded, 'SF Pro Rounded', ui-sans-serif, system-ui, sans-serif",
  },
};

/** Osnovna veličina teksta i korak skale. */
const TYPE_SCALES: Record<ThemeTokens['typeScale'], { base: string; ratio: string }> = {
  small: { base: '0.95rem', ratio: '1.18' },
  medium: { base: '1.05rem', ratio: '1.24' },
  large: { base: '1.15rem', ratio: '1.3' },
};

/** Vertikalni ritam sekcija. */
const DENSITIES: Record<
  ThemeTokens['density'],
  { section: string; gap: string; inline: string }
> = {
  compact: { section: '3rem', gap: '1rem', inline: '1.25rem' },
  comfortable: { section: '4.5rem', gap: '1.5rem', inline: '1.5rem' },
  airy: { section: '6.5rem', gap: '2rem', inline: '1.75rem' },
};

const RADII: Record<ThemeTokens['radius'], string> = {
  sharp: '0px',
  soft: '10px',
  rounded: '20px',
  pill: '999px',
};

const SHADOWS: Record<ThemeTokens['shadow'], string> = {
  none: 'none',
  soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 10px 28px -16px rgb(0 0 0 / 0.16)',
  lifted: '0 2px 6px rgb(0 0 0 / 0.07), 0 22px 48px -20px rgb(0 0 0 / 0.28)',
};

/**
 * Trajanje animacija po intenzitetu.
 *
 * `none` daje 0ms, što je isto ponašanje kao kod `prefers-reduced-motion` -
 * korisnik sa tom postavkom i tema bez animacija koriste isti put koda.
 */
const MOTION: Record<ThemeTokens['motion'], { duration: string; distance: string }> = {
  none: { duration: '0ms', distance: '0px' },
  subtle: { duration: '450ms', distance: '8px' },
  balanced: { duration: '650ms', distance: '16px' },
  expressive: { duration: '850ms', distance: '28px' },
};

/** CSS promenljive pozivnice; prefiks `--inv-` sprečava sudar sa aplikacijom. */
export function themeToCssVars(tokens: ThemeTokens): CSSProperties {
  const fonts = FONT_PAIRS[tokens.fontPair];
  const scale = TYPE_SCALES[tokens.typeScale];
  const density = DENSITIES[tokens.density];
  const motion = MOTION[tokens.motion];

  return {
    '--inv-bg': tokens.palette.background,
    '--inv-surface': tokens.palette.surface,
    '--inv-text': tokens.palette.text,
    '--inv-text-muted': tokens.palette.textMuted,
    '--inv-accent': tokens.palette.accent,
    '--inv-accent-contrast': tokens.palette.accentContrast,
    '--inv-border': tokens.palette.border,

    '--inv-font-display': fonts.display,
    '--inv-font-body': fonts.body,
    '--inv-font-size': scale.base,
    '--inv-scale-ratio': scale.ratio,

    '--inv-section-space': density.section,
    '--inv-gap': density.gap,
    '--inv-inline-space': density.inline,

    '--inv-radius': RADII[tokens.radius],
    '--inv-shadow': SHADOWS[tokens.shadow],

    '--inv-motion-duration': motion.duration,
    '--inv-motion-distance': motion.distance,
  } as CSSProperties;
}

/**
 * Klase koje zavise od stilskih izbora teme.
 *
 * Vraćaju se kao `data-*` atributi umesto klasa da bi CSS mogao da ih cilja
 * atributskim selektorima, bez generisanja kombinatorne eksplozije Tailwind
 * klasa koje bi build morao da zadrži.
 */
export function themeDataAttributes(tokens: ThemeTokens): Record<string, string> {
  return {
    'data-button': tokens.buttonStyle,
    'data-card': tokens.cardStyle,
    'data-divider': tokens.dividerStyle,
    'data-background': tokens.backgroundStyle,
    'data-motion': tokens.motion,
    'data-icons': tokens.iconStyle,
    'data-density': tokens.density,
  };
}
