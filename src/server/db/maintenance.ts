import 'dotenv/config';

import { pruneExpiredData } from '@/server/services/privacy';

/**
 * Redovno održavanje (zahtev 25 i 8.8).
 *
 * Pokreće se iz cron zadatka (`pnpm maintenance`), jednom dnevno. Radi samo
 * brisanje po pravilima retencije - ništa što bi trebalo da se dešava usred
 * korisničkog zahteva.
 *
 * Skripta namerno **ne** hvata greške: ako čišćenje ne uspe, cron mora da vidi
 * neuspeh, a ne uredan izlaz sa nulom.
 */
async function main(): Promise<void> {
  const started = Date.now();
  const report = await pruneExpiredData();

  console.log('Održavanje je završeno za %d ms:', Date.now() - started);
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
