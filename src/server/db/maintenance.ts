import 'dotenv/config';

import { sendPendingDigests } from '@/server/services/notifications';
import { pruneExpiredData } from '@/server/services/privacy';

/**
 * Redovno održavanje (zahtev 25 i 8.8).
 *
 * Pokreće se iz cron zadatka (`pnpm maintenance`), jednom dnevno: šalje
 * odložene rezimee odgovora i briše po pravilima retencije - ništa što bi
 * trebalo da se dešava usred korisničkog zahteva.
 *
 * Skripta namerno **ne** hvata greške: ako čišćenje ne uspe, cron mora da vidi
 * neuspeh, a ne uredan izlaz sa nulom.
 */
async function main(): Promise<void> {
  const started = Date.now();

  const daily = await sendPendingDigests('daily');
  const weekly = await sendPendingDigests('weekly');
  const report = await pruneExpiredData();

  console.log('Održavanje je završeno za %d ms:', Date.now() - started);
  console.log('  dnevni rezimei: poslato %d, preskočeno %d', daily.sent, daily.skipped);
  console.log('  nedeljni rezimei: poslato %d, preskočeno %d', weekly.sent, weekly.skipped);
  for (const [what, count] of Object.entries(report)) {
    console.log('  %s: %d', what, count);
  }
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error('Održavanje nije uspelo:', error);
    process.exit(1);
  },
);
