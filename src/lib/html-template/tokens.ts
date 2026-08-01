/**
 * Tokeni i bekstvovanje u HTML šablonima (zahtev 24 i 39.6).
 *
 * Uvezen sajt se u bazi čuva **jednom obrađen**: mesta na kojima stoji sadržaj
 * organizatora zamenjena su tokenima, a svaki token nosi i kontekst u kom se
 * nalazi. Zbog toga renderovanje ne mora da razume HTML - jedan prolaz kroz
 * tekst je dovoljan, a način bekstvovanja se ne pogađa nego čita iz samog
 * tokena.
 *
 * | Token | Gde stoji | Kako se bekstvuje |
 * |-------|-----------|-------------------|
 * | `{{text:kljuc}}` | tekst elementa | `&`, `<`, `>` |
 * | `{{attr:kljuc}}` | vrednost atributa | `&`, `<`, `>`, `"`, `'` |
 * | `{{js:kljuc}}` | string u JavaScriptu | navodnici, obrnuta kosa crta, `<`, prelomi |
 * | `{{asset:putanja}}` | fajl šablona | razrešava se u URL, ne u korisnički sadržaj |
 *
 * **Nijedna vrednost polja nikad ne ulazi u dokument kao HTML.** Organizator
 * piše tekst, ne oznake; ako otkuca `<b>`, gost će videti `<b>`, a ne podebljan
 * tekst. To je namerno: šablon je tuđi kod koji mi serviramo sa svog domena, pa
 * bi svaka rupa ovde bila rupa u celoj platformi.
 */

/** Kontekst u kom vrednost završava; deo je samog tokena. */
export type TokenContext = 'text' | 'attr' | 'js';

/** `{{text:ime}}`, `{{attr:src}}`, `{{js:datum}}`, `{{asset:css/main.css}}`. */
const TOKEN_PATTERN = /\{\{(text|attr|js|asset):([^}]{1,200})\}\}/g;

export function fieldToken(context: TokenContext, key: string): string {
  return `{{${context}:${key}}}`;
}

export function assetToken(path: string): string {
  return `{{asset:${path}}}`;
}

/** Tekst elementa. */
export function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Vrednost atributa.
 *
 * Bekstvuju se i jednostruki i dvostruki navodnici, jer uvezen sajt nije naš
 * kod i ne možemo da pretpostavimo kojim je navodnicima pisan.
 */
export function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * String u JavaScriptu.
 *
 * `<` postaje `\u003C` zbog `</script>`: bez toga bi vrednost polja mogla da
 * zatvori skriptu i nastavi kao HTML. U+2028 i U+2029 su prelomi reda koje
 * JavaScript ne dozvoljava unutar stringa.
 */
export function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function escapeFor(context: TokenContext, value: string): string {
  switch (context) {
    case 'text':
      return escapeHtmlText(value);
    case 'attr':
      return escapeHtmlAttribute(value);
    case 'js':
      return escapeJsString(value);
  }
}

export type RenderOptions = {
  /** Vrednosti polja; nedostajuće se prikazuju kao prazan tekst. */
  values: Record<string, string>;
  /** Putanja asseta → URL sa kog se servira. */
  assetUrl: (path: string) => string;
};

/**
 * Popunjavanje dokumenta.
 *
 * Jedan prolaz kroz tekst, bez parsiranja: token nosi kontekst, pa se pravi
 * način bekstvovanja bira bez ikakvog pogađanja. Nepoznat ključ daje **prazan**
 * tekst, a ne ostavljen token - gost ne treba da vidi `{{text:imeMlade}}` ako je
 * šablon izmenjen posle kreiranja pozivnice.
 */
export function renderHtmlTemplate(
  document: string,
  { values, assetUrl }: RenderOptions,
): string {
  return document.replace(TOKEN_PATTERN, (_match, kind: string, name: string) => {
    if (kind === 'asset') return escapeHtmlAttribute(assetUrl(name));

    const context = kind as TokenContext;
    return escapeFor(context, values[name] ?? '');
  });
}

/**
 * Razrešavanje **samo** asset tokena, bez bekstvovanja.
 *
 * Koristi se za CSS i JS fajlove šablona: oni se serviraju takvi kakvi jesu,
 * isti za sve pozivnice, pa u njima nema vrednosti korisnika - ali ima putanja
 * ka slikama i fontovima. Bekstvovanje za HTML bi tu bilo pogrešno: `&amp;` u
 * `url(...)` nije isto što i `&`.
 */
export function resolveAssetTokens(
  text: string,
  assetUrl: (path: string) => string,
): string {
  return text.replace(TOKEN_PATTERN, (match, kind: string, name: string) =>
    kind === 'asset' ? assetUrl(name) : match,
  );
}

/** Ključevi polja koje dokument stvarno koristi - provera manifesta pri uvozu. */
export function tokensUsedIn(document: string): {
  fields: string[];
  assets: string[];
} {
  const fields = new Set<string>();
  const assets = new Set<string>();

  for (const match of document.matchAll(TOKEN_PATTERN)) {
    const kind = match[1];
    const name = match[2];
    if (!name) continue;

    if (kind === 'asset') assets.add(name);
    else fields.add(name);
  }

  return { fields: [...fields].sort(), assets: [...assets].sort() };
}
