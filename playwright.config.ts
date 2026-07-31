import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Ručno zadata putanja do Chromiuma.
 *
 * Na razvojnoj mašini i u CI-ju Playwright sam pronalazi pregledač koji je
 * preuzeo (`pnpm exec playwright install chromium`). U okruženjima gde je
 * Chromium već instaliran sistemski, a verzija se ne poklapa sa onom koju
 * Playwright očekuje, dovoljno je postaviti `PLAYWRIGHT_CHROMIUM_PATH`.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOverride = chromiumPath
  ? { launchOptions: { executablePath: chromiumPath } }
  : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'sr-Latn-RS',
    timezoneId: 'Europe/Belgrade',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...launchOverride } },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...launchOverride } },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // Bez spoljnih servisa: pošta ide u konzolu.
      EMAIL_DRIVER: 'console',
      /*
       * `manual`, a ne `dev`.
       *
       * E2E vrti **produkcijski** build (`pnpm start`), a fabrika adaptera
       * namerno odbija `dev` provajdera u produkciji - da korisnik nikad ne bi
       * video lažnu potvrdu uplate. Ručna naplata je ono što bi pravi
       * deployment koristio za uplatnicu i bankovni transfer: narudžbina
       * ostaje u čekanju dok je administrator ne potvrdi.
       */
      PAYMENT_DRIVER: 'manual',
    },
  },
});
