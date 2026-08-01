import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { findExternalReferences } from '@/lib/html-template/audit';
import { splitAtRsvpSlot, splitHtmlDocument } from '@/lib/html-template/document';
import { renderHtmlTemplate } from '@/lib/html-template/tokens';
import { analyzeSite } from '@/server/import/analyze';
import { buildTemplate } from '@/server/import/build';
import { ImportError } from '@/server/import/errors';
import { decodeText, readSiteFiles, type SiteFiles } from '@/server/import/files';
import { parseManifest, type ImportManifest } from '@/server/import/manifest';
import { vendorResources } from '@/server/import/vendor';

/**
 * Uvoz gotovog HTML sajta (zahtev 39.3).
 *
 * Testovi rade nad `tests/fixtures/sajt-proba` - malim sajtom napravljenim
 * ručno, sa svim onim što pravi sajtovi imaju i što uvoz mora da reši: skripta
 * sa CDN-a, font sa Google-a, ugrađena mapa, ukrasna RSVP forma, datum upisan
 * direktno u JavaScript i slika u `style` atributu.
 *
 * Naglasak je na onome što ne sme da prođe. Uvoz koji „skoro” uspe je gori od
 * neuspelog: greška bi se videla tek na tuđoj proslavi.
 */
const FIXTURE = path.join(process.cwd(), 'tests/fixtures/sajt-proba');

const FONT_CSS = `@font-face{font-family:'Probni';src:url(https://fonts.gstatic.test/probni.woff2) format('woff2')}`;

/** Mreža u testu: CDN i Google fonts odgovaraju, sve ostalo je greška. */
const fakeFetch = (async (input: RequestInfo | URL) => {
  const url = String(input);

  if (url.startsWith('https://cdn.primer.test/')) {
    return new Response('window.animacije = function () {};');
  }
  if (url.startsWith('https://fonts.googleapis.com/')) {
    return new Response(FONT_CSS);
  }
  if (url.startsWith('https://fonts.gstatic.test/')) {
    return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32]));
  }

  return new Response('nema', { status: 404 });
}) as typeof fetch;

let files: SiteFiles;
let manifest: ImportManifest;

beforeAll(async () => {
  files = await readSiteFiles(FIXTURE);
  manifest = parseManifest(
    JSON.parse(await readFile(path.join(FIXTURE, 'template.json'), 'utf8')) as unknown,
  );
});

/** Ceo tok uvoza, bez baze: preuzimanje + obrada. */
async function build(overrides: Partial<ImportManifest> = {}) {
  const merged = { ...manifest, ...overrides };
  const vendored = await vendorResources({
    // Testovi ne pišu u folder sa uzorkom; keširanje je stvar CLI-ja.
    cacheRoot: null,
    files,
    vendor: merged.vendor,
    fetchImpl: fakeFetch,
  });

  return buildTemplate({
    manifest: { ...merged, vendor: vendored.vendor },
    files: vendored.files,
    assetUrl: (asset) => `/sabloni-fajlovi/v1/${asset}`,
  });
}

describe('čitanje foldera', () => {
  it('template.json nije fajl šablona', () => {
    // Uputstvo za uvoz ne sme da završi u storage-u ni u dokumentu.
    expect(files.has('template.json')).toBe(false);
    expect(files.has('index.html')).toBe(true);
  });
});

describe('preuzimanje spoljnih resursa', () => {
  it('preuzima i skriptu sa CDN-a i font koji CSS tek pominje', async () => {
    const result = await vendorResources({
      cacheRoot: null,
      files,
      vendor: manifest.vendor,
      fetchImpl: fakeFetch,
    });

    // `fonts.gstatic.test` nije u template.json - nađen je unutar preuzetog CSS-a.
    expect(result.vendor.map((resource) => resource.url)).toContain(
      'https://fonts.gstatic.test/probni.woff2',
    );
    expect(result.files.has('vendor/animacije-1.0.js')).toBe(true);
    expect(result.files.has('vendor/probni.woff2')).toBe(true);
  });

  it('bez mreže kaže šta da se uradi umesto da padne', async () => {
    await expect(
      vendorResources({
        cacheRoot: null,
        files,
        vendor: manifest.vendor,
        fetchImpl: (() => {
          throw new Error('ECONNREFUSED');
        }) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/snimi fajl ručno/i);
  });
});

describe('obrada dokumenta', () => {
  it('u šablonu ne ostaje nijedna adresa ka tuđem domenu', async () => {
    const built = await build();

    expect(findExternalReferences('dokument.html', built.document)).toEqual([]);
    for (const asset of built.assets) {
      expect(
        findExternalReferences(asset.path, decodeText(asset.content)),
      ).toEqual([]);
    }
  });

  it('link koji gost klikće ostaje netaknut', async () => {
    const built = await build();

    // Zahtev ide na tuđi server tek kad gost klikne - to je jedini dozvoljen izuzetak.
    expect(built.document).toContain('href="https://www.salas137.rs"');
  });

  it('ugrađena mapa postaje kartica sa linkom', async () => {
    const built = await build();

    expect(built.document).not.toContain('<iframe');
    expect(built.document).toContain('data-mapa="mestoNaziv"');
    expect(built.document).toContain('rel="noopener noreferrer"');
    expect(built.document).toContain('Otvori u mapama');
  });

  it('ukrasna forma se zamenjuje mestom za pravu RSVP formu', async () => {
    const built = await build();

    expect(built.document).not.toContain('id="ukrasna-forma"');

    const parts = splitHtmlDocument(built.document);
    const slot = splitAtRsvpSlot(parts?.bodyHtml ?? '');
    expect(slot.after).not.toBeNull();
  });

  it('oznake koje platforma sama postavlja se uklanjaju', async () => {
    const built = await build();

    expect(built.document).not.toContain('og:title');
    expect(built.document).not.toContain('<title>');
    // Ono što je autor napisao za prikaz ostaje.
    expect(built.document).toContain('name="viewport"');
  });

  it('skripta sa vrednošću polja ulazi u dokument, biblioteka ostaje fajl', async () => {
    const built = await build();

    // Fajl se servira isti za sve pozivnice, pa vrednost polja u njemu nema ko da zameni.
    expect(built.inlined).toEqual(['js/odbrojavanje.js']);
    expect(built.document).toContain("const DATUM = '{{js:datum}}'");

    const paths = built.assets.map((asset) => asset.path);
    expect(paths).toContain('vendor/animacije-1.0.js');
    expect(paths).not.toContain('js/odbrojavanje.js');
  });

  it('putanje u CSS-u dobijaju konačnu adresu pri uvozu', async () => {
    const built = await build();
    const css = built.assets.find((asset) => asset.path === 'css/stil.css');

    expect(decodeText(css?.content ?? new Uint8Array())).toContain(
      '/sabloni-fajlovi/v1/img/pozadina.png',
    );
  });

  it('u šablon ulaze samo fajlovi koje dokument stvarno koristi', async () => {
    const built = await build();
    const paths = built.assets.map((asset) => asset.path);

    // `img/zvono.mp3` se pominje samo u skripti, ali se preko nje i koristi.
    expect(paths).toContain('img/zvono.mp3');
    expect(paths).toContain('img/nas.png');
    expect(paths).toContain('vendor/probni.woff2');
    // `img/probni.woff2` je referenca iz CSS-a; oba fonta ostaju.
    expect(paths).toContain('img/probni.woff2');
  });
});

describe('popunjavanje vrednostima', () => {
  it('vrednosti organizatora ulaze u dokument bekstvovane po kontekstu', async () => {
    const built = await build();

    const html = renderHtmlTemplate(built.document, {
      values: {
        imena: 'Ana & Marko',
        datum: '2026-09-12',
        datumTekst: '12. septembar 2026.',
        mestoNaziv: 'Salaš 137',
        mestoAdresa: 'Čenej',
        mestoLink: 'https://mapa.test/salas',
        fotografija: 'img/nas.png',
      },
      assetUrl: (asset) => `/sabloni-fajlovi/v1/${asset}`,
    });

    expect(html).toContain('Ana &amp; Marko');
    expect(html).toContain('datetime="2026-09-12"');
    expect(html).toContain('href="https://mapa.test/salas"');
    expect(html).toContain("const DATUM = '2026-09-12'");
    expect(html).not.toContain('{{');
  });

  it('pokušaj proboja kroz vrednost polja ostaje tekst', async () => {
    const built = await build();

    const html = renderHtmlTemplate(built.document, {
      values: {
        imena: '<script>alert(1)</script>',
        datum: '"); fetch("https://zlo.test"); //',
      },
      assetUrl: (asset) => `/sabloni-fajlovi/v1/${asset}`,
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('fetch("https://zlo.test")');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('uvoz staje kad nešto nije u redu', () => {
  it('selektor koji ništa ne pogađa je greška, a ne tiho preskakanje', async () => {
    await expect(
      build({
        form: {
          ...manifest.form,
          fields: manifest.form.fields.map((field) =>
            field.key === 'imena'
              ? { ...field, bind: [{ kind: 'text' as const, selector: '#nepostojece' }] }
              : field,
          ),
        },
      }),
    ).rejects.toThrow(/ništa ne pogađa/);
  });

  it('nepreuzet resurs sa tuđeg domena obara uvoz', async () => {
    await expect(build({ vendor: [] })).rejects.toThrow(/adrese ka tuđim domenima/);
  });

  it('zaboravljena mapa obara uvoz', async () => {
    // Operator je izbacio mapu iz uputstva; `<iframe>` ka Google-u bi ostao u
    // dokumentu i slao IP adresu gosta pre nego što je iko išta pitao.
    const mapFields = new Set(['mestoNaziv', 'mestoAdresa', 'mestoLink']);

    await expect(
      build({
        maps: [],
        form: {
          ...manifest.form,
          fields: manifest.form.fields.filter((field) => !mapFields.has(field.key)),
        },
      }),
    ).rejects.toThrow(/iframe|tuđim domenima/);
  });

  it('sajt koji već ima tokene se odbija', () => {
    const withTokens: SiteFiles = new Map(files);
    withTokens.set(
      'index.html',
      new TextEncoder().encode('<html><body>{{text:ime}}</body></html>'),
    );

    expect(() =>
      buildTemplate({
        manifest,
        files: withTokens,
        assetUrl: (asset) => `/${asset}`,
      }),
    ).toThrow(ImportError);
  });
});

describe('prvi prolaz: predlog uputstva', () => {
  it('prijavljuje spoljne resurse, mapu i ukrasnu formu', () => {
    const report = analyzeSite({ files, entry: 'index.html', slug: 'sajt-proba' });
    const proposal = report.manifest as {
      vendor: Array<{ url: string }>;
      maps: unknown[];
      rsvp: { selector: string } | null;
      name: string;
    };

    expect(proposal.name).toBe('Ana i Marko');
    expect(proposal.vendor.map((resource) => resource.url)).toEqual([
      'https://cdn.primer.test/animacije-1.0.js',
      'https://fonts.googleapis.com/css2?family=Probni',
    ]);
    expect(proposal.maps).toHaveLength(1);
    expect(proposal.rsvp).toEqual({ selector: '#ukrasna-forma' });
  });

  it('predlog je ispravan `template.json`', () => {
    // Operator treba da može da pokrene uvoz odmah, pa tek onda da doteruje.
    const report = analyzeSite({ files, entry: 'index.html', slug: 'sajt-proba' });

    expect(() => parseManifest(report.manifest)).not.toThrow();
  });

  it('predložena polja imaju selektore koji pogađaju tačno jedan element', async () => {
    const report = analyzeSite({ files, entry: 'index.html', slug: 'sajt-proba' });
    const proposal = parseManifest(report.manifest);

    const built = await build({
      form: proposal.form,
      maps: proposal.maps,
      rsvp: proposal.rsvp,
    });

    expect(built.fieldDefinitions.fields.length).toBeGreaterThan(3);
    expect(built.document).toContain('{{text:');
  });
});
