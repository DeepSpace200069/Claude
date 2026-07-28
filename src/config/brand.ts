/**
 * Centralno mesto za brendiranje.
 *
 * Naziv, domen, kontakt i akcenat teme čitaju se odavde, tako da promena
 * brenda (naziv proizvoda, logotip, boje, domen) ne zahteva izmene po
 * komponentama. Vrednosti dolaze iz env promenljivih sa razumnim podrazumevanim
 * vrednostima za development.
 */
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Pozivnica',
  domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN ?? 'pozivnica.rs',
  supportEmail:
    process.env.NEXT_PUBLIC_BRAND_SUPPORT_EMAIL ?? 'podrska@pozivnica.rs',
  /** Kratak slogan, koristi se u meta opisima i u zaglavlju. */
  taglineKey: 'brand.tagline',
  /** Logotip je SVG komponenta da bi mogao da nasledi boju teme. */
  logo: {
    /** Monogram koji se prikazuje kada nema prostora za pun logotip. */
    monogram: 'P',
  },
  social: {
    instagram: '',
    facebook: '',
  },
} as const;

export type Brand = typeof brand;

/** Apsolutni URL aplikacije, bezbedan za korišćenje na serveru i klijentu. */
export function appUrl(path = '/'): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    'http://localhost:3000';
  return new URL(path, base).toString();
}
