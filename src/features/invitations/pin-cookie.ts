/**
 * Ime kolačića kojim se pamti da je PIN pozivnice već unet.
 *
 * Stoji izvan modula sa server akcijama namerno: modul označen sa `'use server'`
 * sme da izvozi **isključivo** asfinkrone funkcije, pa bi obična konstanta u
 * njemu poništila sve njegove izvoze.
 *
 * Prefiks se spaja sa slugom, a kolačić se postavlja na putanju `/p/<slug>`, pa
 * otključavanje jedne pozivnice ne otključava nijednu drugu.
 */
export const PIN_COOKIE_PREFIX = 'pozivnica-pin-';

export function pinCookieName(slug: string): string {
  return `${PIN_COOKIE_PREFIX}${slug}`;
}
