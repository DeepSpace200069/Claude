import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/server/authz';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import { exportUserData } from '@/server/services/privacy';

/**
 * Preuzimanje sopstvenih podataka (zahtev 25).
 *
 * Rezultat je fajl, pa je ovo ruta, a ne server akcija. Odgovor se nikad ne
 * kešira i nikad ne indeksira - u njemu su i podaci gostiju.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Prijavite se.' }, { status: 401 });
  }

  const limit = await rateLimit(`export:${user.id}`, RATE_LIMITS.dataExport);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Previše preuzimanja u kratkom roku. Pokušajte kasnije.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(
            Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  const data = await exportUserData(user.id);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="pozivnica-podaci-${stamp}.json"`,
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
