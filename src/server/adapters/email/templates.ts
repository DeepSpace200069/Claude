import { brand } from '@/config/brand';
import type { Locale } from '@/i18n/config';
import { getMessagesFor } from '@/i18n/server';
import { createTranslator } from '@/i18n/translator';

import type { EmailMessage } from './types';

/**
 * Šabloni mejlova.
 *
 * HTML je namerno jednostavan i inline-stilizovan: klijenti za poštu ne podržavaju
 * moderni CSS, a cilj je da poruka bude čitljiva svuda, uključujući tekstualni
 * fallback koji uvek šaljemo uz HTML.
 */
const layout = (options: {
  heading: string;
  body: string[];
  cta?: { label: string; url: string };
  footer: string;
}) => `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#2b2724;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e0d8;border-radius:14px;">
      <tr><td style="padding:32px;">
        <p style="margin:0 0 24px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#6d655e;">${escapeHtml(brand.name)}</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(options.heading)}</h1>
        ${options.body
          .map(
            (paragraph) =>
              `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4a443f;">${escapeHtml(paragraph)}</p>`,
          )
          .join('')}
        ${
          options.cta
            ? `<p style="margin:26px 0 8px;">
                 <a href="${options.cta.url}" style="display:inline-block;padding:13px 26px;background:#7d3f57;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">${escapeHtml(options.cta.label)}</a>
               </p>
               <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#8a827a;word-break:break-all;">${options.cta.url}</p>`
            : ''
        }
      </td></tr>
      <tr><td style="padding:0 32px 28px;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#8a827a;border-top:1px solid #e6e0d8;padding-top:16px;">${escapeHtml(options.footer)}</p>
      </td></tr>
    </table>
  </body>
</html>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toText(options: {
  heading: string;
  body: string[];
  cta?: { label: string; url: string };
  footer: string;
}): string {
  return [
    options.heading,
    '',
    ...options.body,
    ...(options.cta ? ['', `${options.cta.label}: ${options.cta.url}`] : []),
    '',
    options.footer,
  ].join('\n');
}

async function translatorFor(locale: Locale) {
  const messages = await getMessagesFor(locale);
  return createTranslator(locale, messages);
}

/** Magic link za prijavu. */
export async function magicLinkEmail(options: {
  to: string;
  url: string;
  locale: Locale;
}): Promise<EmailMessage> {
  const t = await translatorFor(options.locale);

  const content = {
    heading: t('auth.loginTitle'),
    body: [
      t('auth.magicLinkSentText', { email: options.to }),
      t('auth.termsNotice'),
    ],
    cta: { label: t('auth.sendMagicLink'), url: options.url },
    footer: `${brand.name} · ${brand.domain}`,
  };

  return {
    to: options.to,
    subject: `${t('auth.loginTitle')} · ${brand.name}`,
    html: layout(content),
    text: toText(content),
    tag: 'magic-link',
  };
}

/** Poruka dobrodošlice posle prve prijave. */
export async function welcomeEmail(options: {
  to: string;
  name: string | null;
  appUrl: string;
  locale: Locale;
}): Promise<EmailMessage> {
  const t = await translatorFor(options.locale);

  const content = {
    heading: options.name
      ? t('dashboard.greeting', { name: options.name })
      : t('dashboard.greetingAnonymous'),
    body: [t('brand.description'), t('marketing.heroNote')],
    cta: { label: t('marketing.heroCta'), url: `${options.appUrl}/app/dogadjaji/novi` },
    footer: `${brand.name} · ${brand.domain}`,
  };

  return {
    to: options.to,
    subject: `${t('brand.tagline')} · ${brand.name}`,
    html: layout(content),
    text: toText(content),
    tag: 'welcome',
  };
}

/** Poziv saradniku na uređivanje događaja. */
export async function collaboratorInviteEmail(options: {
  to: string;
  inviterName: string;
  eventName: string;
  url: string;
  locale: Locale;
}): Promise<EmailMessage> {
  const t = await translatorFor(options.locale);

  const content = {
    heading: `${options.inviterName} · ${options.eventName}`,
    body: [t('brand.description')],
    cta: { label: t('common.open'), url: options.url },
    footer: `${brand.name} · ${brand.domain}`,
  };

  return {
    to: options.to,
    subject: `${options.eventName} · ${brand.name}`,
    html: layout(content),
    text: toText(content),
    tag: 'collaborator-invite',
  };
}

/**
 * Obaveštenje o novom odgovoru (zahtev 28).
 *
 * Sadrži ime gosta i status, ali **ne** i njegov kontakt: mejl putuje kroz
 * tuđe servere, a organizator kontakt ionako vidi u aplikaciji.
 */
export async function rsvpNotificationEmail(options: {
  to: string;
  eventName: string;
  guestName: string;
  status: 'yes' | 'no' | 'maybe';
  people: number;
  url: string;
  locale: Locale;
}): Promise<EmailMessage> {
  const t = await translatorFor(options.locale);

  const statusText = t.dynamic(`notifications.status.${options.status}`);

  const content = {
    heading: t('notifications.newResponseHeading', { event: options.eventName }),
    body: [
      t('notifications.newResponseBody', {
        guest: options.guestName,
        status: statusText,
        people: options.people,
      }),
      t('notifications.frequencyNote'),
    ],
    cta: { label: t('notifications.openResponses'), url: options.url },
    footer: `${brand.name} · ${brand.domain}`,
  };

  return {
    to: options.to,
    subject: t('notifications.newResponseSubject', { event: options.eventName }),
    html: layout(content),
    text: toText(content),
    tag: 'rsvp-notification',
  };
}

/**
 * Rezime odgovora za period (dnevni ili nedeljni).
 *
 * Šalje se **samo** ako je nešto stiglo - prazan rezime je poruka koja ne nosi
 * nijedan podatak, a troši poverenje primaoca.
 */
export async function rsvpDigestEmail(options: {
  to: string;
  period: 'daily' | 'weekly';
  events: Array<{ name: string; yes: number; no: number; maybe: number; people: number }>;
  url: string;
  locale: Locale;
}): Promise<EmailMessage> {
  const t = await translatorFor(options.locale);

  const heading =
    options.period === 'daily'
      ? t('notifications.digestDailyHeading')
      : t('notifications.digestWeeklyHeading');

  const body = options.events.map((event) =>
    t('notifications.digestLine', {
      event: event.name,
      yes: event.yes,
      no: event.no,
      maybe: event.maybe,
      people: event.people,
    }),
  );

  const content = {
    heading,
    body: [...body, t('notifications.frequencyNote')],
    cta: { label: t('notifications.openApp'), url: options.url },
    footer: `${brand.name} · ${brand.domain}`,
  };

  return {
    to: options.to,
    subject: heading,
    html: layout(content),
    text: toText(content),
    tag: `rsvp-digest-${options.period}`,
  };
}

/** Potvrda uplate - račun ostaje u sandučetu i kada korisnik obriše nalog. */
export async function paymentReceiptEmail(options: {
  to: string;
  eventName: string;
  planName: string;
  amount: string;
  url: string;
  locale: Locale;
}): Promise<EmailMessage> {
  const t = await translatorFor(options.locale);

  const content = {
    heading: t('notifications.receiptHeading'),
    body: [
      t('notifications.receiptBody', {
        plan: options.planName,
        event: options.eventName,
        amount: options.amount,
      }),
    ],
    cta: { label: t('notifications.openBilling'), url: options.url },
    footer: `${brand.name} · ${brand.domain}`,
  };

  return {
    to: options.to,
    subject: t('notifications.receiptSubject', { event: options.eventName }),
    html: layout(content),
    text: toText(content),
    tag: 'payment-receipt',
  };
}
