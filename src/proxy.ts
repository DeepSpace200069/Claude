import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (ranije "middleware").
 *
 * Namerno **ne** proverava sesiju: Auth.js koristi bazu za sesije, a proxy
 * radi na Edge runtime-u gde nema pristup bazi. Autorizacija je u server
 * komponentama i akcijama (`requireUser`, `requireEventAccess`), gde i treba da
 * bude - proxy koji "štiti" rutu, a akcija je nezaštićena, lažan je osećaj
 * sigurnosti (zahtev 24).
 *
 * Ovde radimo samo ono što pripada ivici: sigurnosna zaglavlja koja zavise od
 * putanje i normalizaciju sluga javnih pozivnica.
 */
export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  /*
   * Javne pozivnice: veliko slovo u slugu vodi na isti sadržaj, pa preusmeravamo
   * na kanonski oblik umesto da imamo dva URL-a za istu stranicu.
   *
   * Normalizuje se **samo segment sluga**, nikad ostatak putanje. Personalizovani
   * linkovi i linkovi za izmenu odgovora nose token iz abecede sa velikim slovima
   * (`/p/ana-i-marko/D9740D4D…`), a token se poredi po hešu - spuštanje na mala
   * slova bi tiho pokvarilo svaki lični link koji je već poslat gostima.
   */
  if (pathname.startsWith('/p/')) {
    const canonical = canonicalInvitationPath(pathname);

    if (canonical !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = canonical;
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

/** `/p/<slug>/...` sa slugom u malim slovima; ostatak putanje ostaje netaknut. */
function canonicalInvitationPath(pathname: string): string {
  const segments = pathname.split('/');
  const slug = segments[2];

  if (!slug) return pathname;

  segments[2] = slug.toLowerCase();
  return segments.join('/');
}

export const config = {
  matcher: [
    /*
     * Preskačemo statičke fajlove i Next interne rute - middleware na svakom
     * zahtevu za sliku je čist trošak. `sabloni-fajlovi` su fajlovi uvezenih
     * šablona: jedna pozivnica ih povuče desetak, a nijedan nije stranica.
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads|sabloni-fajlovi|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|woff2?)$).*)',
  ],
};
