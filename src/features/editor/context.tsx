'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { Entitlements } from '@/features/billing/entitlements';

/**
 * Nepromenljivi podaci uređivača.
 *
 * Odvojeno od `store.tsx` namerno: ovo se ne menja dok je stranica otvorena, pa
 * ne treba da bude deo stanja koje se poredi pri svakoj izmeni.
 *
 * `entitlements` su ovde da bi interfejs mogao da **objasni** zašto je nešto
 * zaključano. Odluka i dalje pada na serveru - svaka provera se ponavlja u
 * `saveInvitationDraft` (zahtev 24 i 39.9).
 */
export type EditorConfig = {
  eventId: string;
  invitationId: string;
  publicSlug: string;
  entitlements: Entitlements;
  /** Koliko je fotografija već otpremljeno u okviru ovog događaja. */
  photoCount: number;
};

const ConfigContext = createContext<EditorConfig | null>(null);

export function EditorConfigProvider({
  config,
  children,
}: {
  config: EditorConfig;
  children: ReactNode;
}) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useEditorConfig(): EditorConfig {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useEditorConfig mora biti korišćen unutar <EditorConfigProvider>.');
  }
  return config;
}
