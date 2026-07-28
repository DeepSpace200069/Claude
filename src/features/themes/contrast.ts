/**
 * Provera kontrasta (zahtev 10 i 31).
 *
 * Korisnik sme da menja paletu, ali ne sme da napravi nečitljivu pozivnicu, pa
 * svaku kombinaciju boja proveravamo po WCAG 2.1 formuli za odnos kontrasta.
 */

export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1] as string, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

/**
 * `oklch(L C H)` -> sRGB.
 *
 * Implementirano ručno da bismo izbegli zavisnost od biblioteke za boje u
 * bundle-u javne pozivnice.
 */
function oklchToRgb(input: string): Rgb | null {
  const match =
    /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+\s*)?\)$/.exec(
      input.trim(),
    );
  if (!match) return null;

  const rawL = Number.parseFloat(match[1] as string);
  const L = input.includes('%') ? rawL / 100 : rawL;
  const C = Number.parseFloat(match[2] as string);
  const hDeg = Number.parseFloat(match[3] as string);
  const h = (hDeg * Math.PI) / 180;

  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    return clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };

  return {
    r: Math.round(gamma(lr) * 255),
    g: Math.round(gamma(lg) * 255),
    b: Math.round(gamma(lb) * 255),
  };
}

export function parseColor(color: string): Rgb | null {
  return color.trim().startsWith('#') ? hexToRgb(color) : oklchToRgb(color);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Odnos kontrasta dve boje (1 = identične, 21 = crna/bela). */
export function contrastRatio(foreground: string, background: string): number {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return 0;

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(
  foreground: string,
  background: string,
  { large = false }: { large?: boolean } = {},
): boolean {
  const required = large ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
  return contrastRatio(foreground, background) >= required - 0.01;
}

export type ContrastIssue = {
  pair: string;
  ratio: number;
  required: number;
};

/**
 * Proverava sve bitne parove boja u temi.
 * Vraća listu problema - prazna lista znači da je tema čitljiva.
 */
export function auditThemeContrast(palette: {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
}): ContrastIssue[] {
  const checks: Array<{ pair: string; fg: string; bg: string; required: number }> = [
    { pair: 'text/background', fg: palette.text, bg: palette.background, required: WCAG_AA_NORMAL },
    { pair: 'text/surface', fg: palette.text, bg: palette.surface, required: WCAG_AA_NORMAL },
    {
      pair: 'textMuted/background',
      fg: palette.textMuted,
      bg: palette.background,
      required: WCAG_AA_LARGE,
    },
    {
      pair: 'accentContrast/accent',
      fg: palette.accentContrast,
      bg: palette.accent,
      required: WCAG_AA_NORMAL,
    },
  ];

  return checks
    .map(({ pair, fg, bg, required }) => ({
      pair,
      ratio: Number(contrastRatio(fg, bg).toFixed(2)),
      required,
    }))
    .filter((issue) => issue.ratio < issue.required - 0.01);
}
