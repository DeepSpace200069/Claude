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

  // Javne pozivnice: veliko slovo u slugu vodi na isti sadržaj, pa preusmeravamo
  // na kanonski oblik umesto da imamo dva URL-a za istu stranicu.
  if (pathname.startsWith('/p/')) {
    const lower = pathname.toLowerCase();
    if (lower !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = lower;
      return NextResponse.redirect(url, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Preskačemo statičke fajlove i Next interne rute - middleware na svakom
     * zahtevu za sliku je čist trošak.
     */
    '/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|webp|avif|ico|woff2?)$).*)',
  ],
};
