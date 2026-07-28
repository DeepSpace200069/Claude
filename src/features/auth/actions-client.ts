'use server';

import { signOut } from '@/server/auth';

/**
 * Odjava.
 *
 * Namerno je server akcija koja se poziva iz `<form action>`: tako odjava radi
 * i bez JavaScripta i nosi ugrađenu CSRF zaštitu server akcija (zahtev 24).
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
