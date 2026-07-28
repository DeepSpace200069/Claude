import { z } from 'zod';

/**
 * Design tokeni teme pozivnice (zahtev 10).
 *
 * Sadržaj pozivnice i njen izgled su namerno odvojeni: iste sekcije se
 * renderuju kroz bilo koju temu. Tokeni se u renderer ubrizgavaju kao inline
 * CSS promenljive na korenu pozivnice, pa tema nikad ne "curi" u aplikaciju.
 *
 * Skup vrednosti je zatvoren (unije umesto slobodnog teksta) da korisnik ne bi
 * mogao da napravi nečitljivu pozivnicu - zahtev 10, poslednji pasus.
 */

/** Boja u `oklch`/`hex` zapisu; validira se i pri unosu i pri renderovanju. */
const colorSchema = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{6}|oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+\s*(\/\s*[\d.]+\s*)?\))$/,
    'Boja mora biti u #rrggbb ili oklch() zapisu.',
  );

export const FONT_PAIRS = [
  'serif-editorial',
  'serif-romantic',
  'sans-modern',
  'sans-geometric',
  'mixed-classic',
  'display-playful',
] as const;

export const BUTTON_STYLES = ['solid', 'outline', 'soft', 'underline'] as const;
export const CARD_STYLES = ['flat', 'bordered', 'elevated', 'paper'] as const;
export const DIVIDER_STYLES = ['none', 'line', 'ornament', 'botanical', 'dots'] as const;
export const BACKGROUND_STYLES = [
  'plain',
  'gradient',
  'texture-paper',
  'texture-linen',
  'photo',
] as const;
export const MOTION_LEVELS = ['none', 'subtle', 'balanced', 'expressive'] as const;
export const DENSITY_LEVELS = ['compact', 'comfortable', 'airy'] as const;
export const ICON_STYLES = ['line', 'solid', 'duotone'] as const;
export const RADIUS_SCALES = ['sharp', 'soft', 'rounded', 'pill'] as const;
export const SHADOW_SCALES = ['none', 'soft', 'lifted'] as const;
export const TYPE_SCALES = ['small', 'medium', 'large'] as const;

export const themeTokensSchema = z.object({
  palette: z.object({
    background: colorSchema,
    surface: colorSchema,
    text: colorSchema,
    textMuted: colorSchema,
    accent: colorSchema,
    accentContrast: colorSchema,
    border: colorSchema,
  }),
  fontPair: z.enum(FONT_PAIRS),
  typeScale: z.enum(TYPE_SCALES),
  density: z.enum(DENSITY_LEVELS),
  radius: z.enum(RADIUS_SCALES),
  shadow: z.enum(SHADOW_SCALES),
  buttonStyle: z.enum(BUTTON_STYLES),
  cardStyle: z.enum(CARD_STYLES),
  dividerStyle: z.enum(DIVIDER_STYLES),
  backgroundStyle: z.enum(BACKGROUND_STYLES),
  motion: z.enum(MOTION_LEVELS),
  iconStyle: z.enum(ICON_STYLES),
  /** Dekorativni elementi (grančice, konfete...) - čisto vizuelni sloj. */
  ornaments: z.array(z.string()).max(6).default([]),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

/** Bezbedna podrazumevana tema - koristi se kad šablon ne definiše svoju. */
export const defaultThemeTokens: ThemeTokens = {
  palette: {
    background: '#faf8f5',
    surface: '#ffffff',
    text: '#2b2724',
    textMuted: '#6d655e',
    accent: '#7d3f57',
    accentContrast: '#ffffff',
    border: '#e6e0d8',
  },
  fontPair: 'serif-editorial',
  typeScale: 'medium',
  density: 'comfortable',
  radius: 'soft',
  shadow: 'soft',
  buttonStyle: 'solid',
  cardStyle: 'flat',
  dividerStyle: 'line',
  backgroundStyle: 'plain',
  motion: 'subtle',
  iconStyle: 'line',
  ornaments: [],
};
