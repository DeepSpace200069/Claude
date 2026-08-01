import { describe, expect, it } from 'vitest';

import {
  describeExternalReferences,
  findExternalFrames,
  findExternalReferences,
} from '@/lib/html-template/audit';
import {
  RSVP_SLOT,
  splitAtRsvpSlot,
  splitHtmlDocument,
} from '@/lib/html-template/document';
import {
  escapeHtmlAttribute,
  escapeHtmlText,
  escapeJsString,
  renderHtmlTemplate,
  tokensUsedIn,
} from '@/lib/html-template/tokens';

/**
 * Bekstvovanje i tokeni (zahtev 24).
 *
 * Ovo je jedino mesto na kom korisnički tekst ulazi u tuđi HTML koji mi
 * serviramo sa svog domena. Testovi su zato pisani kao pokušaji proboja, a ne
 * kao provera „radi li zamena”.
 */
describe('bekstvovanje po kontekstu', () => {
  it('tekst ne može da uvede oznaku', () => {
    expect(escapeHtmlText('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('atribut ne može da izađe iz navodnika', () => {
    expect(escapeHtmlAttribute('" onload="alert(1)')).toBe(
      '&quot; onload=&quot;alert(1)',
    );
    expect(escapeHtmlAttribute("' onload='alert(1)")).toBe(
      '&#39; onload=&#39;alert(1)',
    );
  });

  it('JavaScript string ne može da zatvori skriptu', () => {
    const escaped = escapeJsString('</script><script>alert(1)</script>');

    expect(escaped).not.toContain('</script>');
    expect(escaped).toContain('\\u003C');
  });

  it('JavaScript string ne može da izađe iz navodnika', () => {
    expect(escapeJsString(`'; alert(1); //`)).toBe(`\\'; alert(1); //`);
    expect(escapeJsString('a\\b')).toBe('a\\\\b');
  });

  it('prelomi reda ne kvare JavaScript', () => {
    // U+2028 je validan razmak u HTML-u, ali prelom reda u JavaScriptu.
    expect(escapeJsString('a b')).toBe('a\\u2028b');
    expect(escapeJsString('a\nb')).toBe('a\\nb');
  });
});

describe('popunjavanje dokumenta', () => {
  const document = [
    '<h1 data-field="ime">{{text:ime}}</h1>',
    '<img src="{{asset:img/hero.webp}}" alt="{{attr:ime}}">',
    '<script>const datum = "{{js:datum}}";</script>',
  ].join('\n');

  const assetUrl = (path: string) => `/sabloni-fajlovi/test/${path}`;

  it('svaki token dobija bekstvovanje svog konteksta', () => {
    const html = renderHtmlTemplate(document, {
      values: { ime: 'Ana & "Marko"', datum: '2026-09-12' },
      assetUrl,
    });

    expect(html).toContain('<h1 data-field="ime">Ana &amp; "Marko"</h1>');
    expect(html).toContain('alt="Ana &amp; &quot;Marko&quot;"');
    expect(html).toContain('const datum = "2026-09-12";');
  });

  it('asset token postaje URL, ne korisnički sadržaj', () => {
    const html = renderHtmlTemplate(document, { values: {}, assetUrl });

    expect(html).toContain('src="/sabloni-fajlovi/test/img/hero.webp"');
  });

  it('pokušaj proboja kroz vrednost polja ostaje tekst', () => {
    const html = renderHtmlTemplate(document, {
      values: {
        ime: '<img src=x onerror=alert(1)>',
        datum: '"; fetch("https://zlo.example"); //',
      },
      assetUrl,
    });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('fetch("https://zlo.example")');
    expect(html).toContain('&lt;img src=x');
  });

  it('nepoznat ključ daje prazno, a ne ostavljen token', () => {
    // Šablon je izmenjen posle kreiranja pozivnice; gost ne treba da vidi
    // `{{text:ime}}` na ekranu.
    const html = renderHtmlTemplate('<p>{{text:nepostojece}}</p>', {
      values: {},
      assetUrl,
    });

    expect(html).toBe('<p></p>');
  });

  it('spisak tokena razlikuje polja od asseta', () => {
    expect(tokensUsedIn(document)).toEqual({
      fields: ['datum', 'ime'],
      assets: ['img/hero.webp'],
    });
  });
});

describe('rastavljanje dokumenta', () => {
  const document = [
    '<!DOCTYPE html><html lang="sr-Latn" data-tema="tamna"><head>',
    '<meta charset="utf-8"><style>body{margin:0}</style>',
    '</head><body class="pozivnica">',
    `<h1>Ana</h1>${RSVP_SLOT}<footer>Vidimo se</footer>`,
    '</body></html>',
  ].join('');

  it('atributi korena ostaju, jer nose jezik i temu autora', () => {
    const parts = splitHtmlDocument(document);

    expect(parts?.htmlAttributes).toEqual({ lang: 'sr-Latn', 'data-tema': 'tamna' });
    expect(parts?.bodyAttributes).toEqual({ class: 'pozivnica' });
  });

  it('glava i telo se razdvajaju bez svojih oznaka', () => {
    const parts = splitHtmlDocument(document);

    expect(parts?.headHtml).toContain('<style>body{margin:0}</style>');
    expect(parts?.headHtml).not.toContain('<body');
    expect(parts?.bodyHtml).toContain('<h1>Ana</h1>');
    expect(parts?.bodyHtml).not.toContain('</body>');
  });

  it('dvosmislen dokument se odbija umesto da se preseče na pogrešnom mestu', () => {
    // `</body>` u stringu unutar skripte je validan HTML, ali bi ovde presekao
    // dokument prerano. Uvoznik na ovo staje i traži izmenu šablona.
    const tricky = document.replace(
      '<h1>Ana</h1>',
      '<script>const x = "</body>";</script>',
    );

    expect(splitHtmlDocument(tricky)).toBeNull();
  });

  it('telo se deli na mestu RSVP forme', () => {
    const parts = splitHtmlDocument(document);
    const split = splitAtRsvpSlot(parts?.bodyHtml ?? '');

    expect(split.before).toContain('<h1>Ana</h1>');
    expect(split.after).toContain('<footer>');
  });

  it('bez mesta za RSVP ceo HTML ostaje ispred forme', () => {
    // Pozivnica ne sme da ostane bez potvrde dolaska ni kad šablon nema formu.
    expect(splitAtRsvpSlot('<p>bez forme</p>')).toEqual({
      before: '<p>bez forme</p>',
      after: null,
    });
  });
});

describe('provera spoljnih resursa', () => {
  it('nalazi skriptu sa CDN-a', () => {
    const found = findExternalReferences(
      'index.html',
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>',
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.origin).toBe('attribute');
  });

  it('nalazi font iz CSS-a i @import', () => {
    const found = findExternalReferences(
      'css/main.css',
      "@import url('https://fonts.googleapis.com/css2?family=X');\n" +
        "@font-face { src: url(https://fonts.gstatic.com/s/x.woff2) format('woff2'); }",
    );

    expect(found.map((reference) => reference.url).sort()).toEqual([
      'https://fonts.googleapis.com/css2?family=X',
      'https://fonts.gstatic.com/s/x.woff2',
    ]);
  });

  it('ugrađena skripta u HTML-u se proverava kao i zaseban fajl', () => {
    const found = findExternalReferences(
      'index.html',
      '<a href="https://maps.google.com/?q=X">Mapa</a>' +
        '<script>fetch("https://analitika.example/beacon");</script>',
    );

    // Link ostaje izuzet, ali zahtev iz skripte ne prolazi.
    expect(found.map((reference) => reference.url)).toEqual([
      'https://analitika.example/beacon',
    ]);
  });

  it('nalazi ES modul sa unpkg-a', () => {
    const found = findExternalReferences(
      'js/scena.js',
      "import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';",
    );

    expect(found[0]?.origin).toBe('import');
  });

  it('link koji gost klikće nije prekršaj', () => {
    // `<a href>` ne šalje zahtev dok se ne klikne, a pozivnica bez linka ka
    // mapama ne bi bila upotrebljiva.
    const found = findExternalReferences(
      'index.html',
      '<a href="https://maps.google.com/?q=Salaš+137">Mapa</a>',
    );

    expect(found).toEqual([]);
  });

  it('lokalne putanje i data URL-ovi prolaze', () => {
    const found = findExternalReferences(
      'index.html',
      '<img src="assets/img/hero.webp"><img src="data:image/gif;base64,R0lGOD">' +
        '<script src="/sabloni-fajlovi/x/js/app.js"></script>',
    );

    expect(found).toEqual([]);
  });

  it('nalazi zaostao iframe ka mapama', () => {
    const frames = findExternalFrames(
      '<iframe src="https://www.google.com/maps/embed?pb=!1m18"></iframe>',
    );

    expect(frames).toHaveLength(1);
  });

  it('poruka za CLI kaže i fajl i mesto', () => {
    const text = describeExternalReferences([
      { file: 'index.html', url: 'https://cdn.example/x.js', origin: 'attribute' },
    ]);

    expect(text).toContain('index.html');
    expect(text).toContain('attribute');
    expect(text).toContain('https://cdn.example/x.js');
  });
});
