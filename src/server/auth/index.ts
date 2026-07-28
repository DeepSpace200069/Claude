import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth, { type DefaultSession } from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Google from 'next-auth/providers/google';

import { getEnv } from '@/lib/env';
import type { Locale } from '@/i18n/config';
import { db } from '@/server/db';
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from '@/server/db/schema';

import { MagicLinkProvider } from './email-provider';

/**
 * Auth.js v5 konfiguracija.
 *
 * Koristi se `database` strategija sesija: magic-link prijava ionako zahteva
 * adapter, a serverska sesija znači da opoziv pristupa deluje odmah - bitno
 * kada organizator ukloni saradnika.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'user' | 'admin';
      locale: Locale;
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'user' | 'admin';
    locale?: Locale;
  }
}

function buildProviders(): Provider[] {
  const env = getEnv();
  const providers: Provider[] = [MagicLinkProvider({ from: env.EMAIL_FROM })];

  // Google prijava je opciona: bez ključeva se dugme ne prikazuje uopšte.
  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        // Povezivanje naloga po email adresi je isključeno: napadač koji
        // registruje Google nalog sa tuđim emailom ne sme da preuzme nalog.
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }

  return providers;
}

/** Da li je Google prijava konfigurisana (koristi ga stranica za prijavu). */
export function isGoogleEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();

  return {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    providers: buildProviders(),
    secret: env.AUTH_SECRET,
    trustHost: env.AUTH_TRUST_HOST || env.NODE_ENV !== 'production',
    session: {
      strategy: 'database',
      maxAge: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    pages: {
      signIn: '/login',
      verifyRequest: '/login/proveri-email',
      error: '/login/greska',
    },
    callbacks: {
      /**
       * Sesija nosi ulogu i jezik da bi server komponente mogle da autorizuju i
       * lokalizuju bez dodatnog upita ka bazi pri svakom renderu.
       */
      session({ session, user }) {
        session.user.id = user.id;
        session.user.role = user.role ?? 'user';
        session.user.locale = user.locale ?? 'sr-Latn';
        return session;
      },
    },
    events: {
      /**
       * Novi korisnik dobija ulogu `user`; administratora postavlja isključivo
       * postojeći administrator ili seed skripta - nikad sam korisnik.
       */
      async signIn({ user, isNewUser }) {
        if (isNewUser && user.email) {
          const { welcomeEmail } = await import(
            '@/server/adapters/email/templates'
          );
          const { getEmailAdapter } = await import('@/server/adapters/email');

          const message = await welcomeEmail({
            to: user.email,
            name: user.name ?? null,
            appUrl: env.APP_URL,
            locale: user.locale ?? 'sr-Latn',
          });
          await getEmailAdapter().send(message);
        }
      },
    },
  };
});
