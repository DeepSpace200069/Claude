/**
 * UUID koji radi i u pregledaču i na serveru.
 *
 * `src/lib/ids.ts` uvozi `node:crypto` i namerno ostaje serverski - uređivač
 * pravi identifikatore novih sekcija na klijentu, pre nego što ih server vidi.
 *
 * `crypto.randomUUID` postoji u Node-u 19+ i u svim pregledačima u sigurnom
 * kontekstu (https i localhost). Rezerva koristi `getRandomValues`, koji je
 * dostupan i u nesigurnom kontekstu, tako da uređivač radi i kada se aplikacija
 * otvori preko obične http adrese u lokalnoj mreži.
 */
export function newId(): string {
  const source = globalThis.crypto;

  if (typeof source?.randomUUID === 'function') {
    return source.randomUUID();
  }

  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);

  // Verzija 4, varijanta 10xx - isti oblik koji baza očekuje za `uuid` kolonu.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
