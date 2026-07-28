import type { EmailConfig } from 'next-auth/providers';

import { getEmailAdapter } from '@/server/adapters/email';
import { magicLinkEmail } from '@/server/adapters/email/templates';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config';

/**
 * Magic-link provajder.
 *
 * Auth.js nudi gotov Nodemailer provajder, ali on povlači SMTP zavisnost i
 * zaobilazi naš email adapter. Ovde definišemo provajder tipa `email` koji
 * slanje delegira adapteru, pa magic link u developmentu ide u terminal, a u
 * produkciji kroz Resend - bez ijedne izmene u logici prijave.
 */
export function MagicLinkProvider(options: {
  from: string;
  /** Jezik poruke; dolazi iz kolačića jezika ako postoji. */
  getLocale?: () => Locale;
}): EmailConfig {
  return {
    id: 'email',
    type: 'email',
    name: 'Email',
    from: options.from,
    /** Link važi 24 sata - isto piše i u tekstu poruke. */
    maxAge: 24 * 60 * 60,
    options: {},
    async sendVerificationRequest({ identifier, url }) {
      const locale = options.getLocale?.() ?? DEFAULT_LOCALE;
      const message = await magicLinkEmail({
        to: identifier,
        url,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
      });

      const result = await getEmailAdapter().send(message);

      if (!result.ok) {
        // Auth.js prikazuje generičku grešku korisniku; detalj ide u log.
        throw new Error(`Slanje magic linka nije uspelo: ${result.error}`);
      }
    },
  };
}
