import { expect, test } from './fixtures';

/**
 * Performanse i stvari koje tiho otkažu (zahtev 32).
 *
 * Ovo nisu merenja brzine - ona zavise od mašine i nemaju smisla u CI-ju. Ovde
 * su provere koje hvataju **tihe kvarove**: stranica koja i dalje radi, ali je
 * osetno teža ili izgleda drugačije nego što je zamišljeno.
 */
test.describe('performanse javnih stranica', () => {
  test('font stek se stvarno primenjuje', async ({ page }) => {
    await page.goto('/');

    const fonts = await page.evaluate(() => {
      const heading = document.querySelector('h1');
      return {
        body: getComputedStyle(document.body).fontFamily,
        display: heading ? getComputedStyle(heading).fontFamily : '',
      };
    });

    /*
     * Regresija koja se ne vidi u kodu: `--font-display` je nekad pokazivao sam
     * na sebe, pa je cela deklaracija bila nevažeća i naslovi su dobijali
     * podrazumevani font pregledača. Test pada čim se to ponovi.
     */
    expect(fonts.body).toContain('ui-sans-serif');
    expect(fonts.display).toContain('Iowan Old Style');
  });

  test('početna ne učitava web fontove', async ({ page }) => {
    const fontRequests: string[] = [];

    page.on('request', (request) => {
      if (request.resourceType() === 'font') fontRequests.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Sistemski fontovi su svesna odluka: nema dodatnog zahteva ni pomeranja
    // teksta kada font stigne.
    expect(fontRequests).toEqual([]);
  });

  test('stranice ne vuku ništa sa tuđih domena', async ({ page, baseURL }) => {
    const ownHost = new URL(baseURL ?? 'http://localhost:3000').host;
    const external: string[] = [];

    page.on('request', (request) => {
      if (new URL(request.url()).host !== ownHost) external.push(request.url());
    });

    await page.goto('/sabloni');
    await page.waitForLoadState('networkidle');

    // Nema analitike, nema fontova sa CDN-a, nema ugrađenih mapa - i CSP to
    // ionako zabranjuje, ali politika se lako olabavi, a ovaj test ne.
    expect(external).toEqual([]);
  });

  test('galerija šablona stiže gotova iz prvog odgovora', async ({ page }) => {
    const response = await page.goto('/sabloni');
    const html = (await response?.text()) ?? '';

    // Naslov i bar jedan šablon stižu u prvom odgovoru servera.
    expect(html).toContain('data-template-slug');
  });
});
