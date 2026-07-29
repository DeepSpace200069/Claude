import { NextResponse } from 'next/server';

import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { isForeignKeyViolation } from '@/server/services/slug';
import { clientFingerprint } from '@/server/request-info';
import {
  getPublicInvitation,
  recordInvitationView,
} from '@/server/services/public-invitation';

/**
 * Beleženje pregleda javne pozivnice (zahtev 27).
 *
 * Odgovor je uvek isti, bez obzira da li pozivnica postoji: ovo je javna ruta i
 * ne sme da posluži kao način da se otkrije koji slugovi postoje.
 *
 * Upisuje se **samo** dnevni zbir. Otisak klijenta se koristi isključivo za
 * ograničavanje broja poziva i nigde se ne čuva.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicSlug: string }> },
): Promise<NextResponse> {
  const { publicSlug } = await params;

  const fingerprint = await clientFingerprint();
  const limit = rateLimit(
    `view:${publicSlug}:${fingerprint}`,
    RATE_LIMITS.invitationView,
  );

  if (limit.allowed) {
    const invitation = await getPublicInvitation(publicSlug);

    // Nacrt i isključena pozivnica se ne broje: gost ih ionako ne vidi, a
    // organizatorov pregled uređivača ne treba da naduva statistiku.
    if (invitation && invitation.status === 'published') {
      const firstVisit = await readFirstVisit(request);

      await recordInvitationView({
        invitationId: invitation.invitationId,
        timeZone: invitation.timeZone,
        isFirstVisit: firstVisit,
      }).catch((error: unknown) => {
        /*
         * Gost je otvorio pozivnicu, a organizator je u međuvremenu obrisao
         * događaj: red na koji brojač pokazuje više ne postoji. To je normalna
         * utrka, a ne kvar - nema šta da se broji i nema o čemu da se viče.
         */
        if (isForeignKeyViolation(error)) return;
        console.error('[statistika] Pregled nije upisan:', error);
      });
    }
  }

  return NextResponse.json({ ok: true });
}

async function readFirstVisit(request: Request): Promise<boolean> {
  try {
    const body: unknown = await request.json();
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as { firstVisit?: unknown }).firstVisit === true
    );
  } catch {
    return false;
  }
}
