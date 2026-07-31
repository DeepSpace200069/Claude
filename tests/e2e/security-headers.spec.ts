import { expect, test } from './fixtures';

/**
 * Sigurnosna zaglavlja (zahtev 24).
 *
 * Zaglavlja se lako izgube pri izmeni konfiguracije, a njihov nestanak ništa ne
 * ruši - zato ih proverava test, a ne pregled koda.
 */
test.describe('sigurnosna zaglavlja', () => {
  test('svaka stranica nosi CSP i osnovna zaglavlja', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    const csp = headers['content-security-policy'] ?? '';

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("form-action 'self'");

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('geolocation=()');

    // Ime servera i verzija okvira nisu podatak koji posetiocu treba.
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('stranica se učitava bez ijedne CSP prijave', async ({ page }) => {
    const violations: string[] = [];

    // Pregledač prijavljuje blokiran resurs kroz konzolu; test pada ako politika
    // zabranjuje nešto što aplikaciji zaista treba.
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('Content Security Policy')) violations.push(text);
    });

    await page.goto('/');
    await page.goto('/sabloni');
    await page.waitForLoadState('networkidle');

    expect(violations).toEqual([]);
  });
});
