import { NextResponse } from 'next/server';

import { appUrl } from '@/config/brand';
import { qrPng } from '@/features/invitations/qr-png';
import { qrSvg } from '@/features/invitations/qr';
import { requireEventAccess } from '@/server/authz';
import { isKnownError } from '@/server/authz/errors';
import { getPublicationState } from '@/server/services/publishing';

/**
 * Preuzimanje QR koda za javni link (zahtev 4.5).
 *
 * Ruta je iza autorizacije iako sam QR ne krije ništa: iz njega bi se inače
 * moglo saznati koji slugovi postoje, a i „preuzmi QR” je radnja organizatora,
 * ne javna usluga.
 *
 * SVG je podrazumevan (crta se bez gubitka na bilo kojoj veličini), a PNG
 * postoji zato što ga štamparije i uređivači teksta traže.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  const { eventId } = await params;

  try {
    const access = await requireEventAccess(eventId, 'event:view');
    const state = await getPublicationState(eventId, access.user.id);

    if (!state) {
      return NextResponse.json({ error: 'Pozivnica ne postoji.' }, { status: 404 });
    }

    const url = appUrl(`/p/${state.slug}`);
    const format = new URL(request.url).searchParams.get('format') === 'png' ? 'png' : 'svg';
    const fileName = `pozivnica-${state.slug}.${format}`;

    if (format === 'png') {
      const png = qrPng(url);
      return new NextResponse(new Uint8Array(png), {
        headers: {
          'content-type': 'image/png',
          'content-disposition': `attachment; filename="${fileName}"`,
          // Privatan sadržaj: keširanje samo u pregledaču organizatora.
          'cache-control': 'private, max-age=300',
        },
      });
    }

    return new NextResponse(qrSvg(url, { color: '#000000' }), {
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
        'cache-control': 'private, max-age=300',
      },
    });
  } catch (error) {
    if (isKnownError(error)) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
