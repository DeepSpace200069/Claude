import { NextResponse } from 'next/server';

import { handlePaymentWebhook } from '@/server/services/billing';

/**
 * Prijem webhookova provajdera naplate (zahtev 17 i 39.7).
 *
 * Telo se čita kao **tekst**, ne kao JSON: potpis se računa nad tačnim bajtima
 * koje je provajder poslao, a `request.json()` bi ih prvo raščlanio i sastavio
 * ponovo, pa bi se potpis razlikovao zbog razmaka ili redosleda ključeva.
 *
 * Rute nema keš i uvek se izvršava na serveru.
 */
export const dynamic = 'force-dynamic';

/**
 * Zaglavlja u kojima provajderi šalju potpis.
 *
 * Različiti provajderi koriste različita imena; adapter proverava sadržaj, a
 * ruta samo pronalazi vrednost.
 */
const SIGNATURE_HEADERS = ['x-payment-signature', 'x-signature', 'stripe-signature'];

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();

  const signature =
    SIGNATURE_HEADERS.map((name) => request.headers.get(name)).find(Boolean) ?? null;

  const outcome = await handlePaymentWebhook(rawBody, signature);

  if (!outcome.ok) {
    // 400, ne 500: neispravan potpis znači da pošiljalac nije ono za šta se
    // predstavlja, pa ponavljanje isporuke nema smisla.
    return NextResponse.json({ error: outcome.error }, { status: 400 });
  }

  // 200 i za `duplicate`: provajder ponavlja isporuku dok ne dobije 2xx, a
  // ponovljena isporuka je uspešno obrađena time što nije promenila ništa.
  return NextResponse.json({ result: outcome.result });
}

/**
 * GET postoji samo da bi pogrešno podešen provajder dobio jasnu poruku umesto
 * Next.js 404 stranice.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { error: 'Webhook prima isključivo POST zahteve.' },
    { status: 405 },
  );
}
