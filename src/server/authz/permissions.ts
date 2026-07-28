/**
 * Matrica dozvola (zahtev 5 i 39.5).
 *
 * Ovo je jedini izvor istine o tome ko šta sme. Interfejs sme da sakrije dugme,
 * ali odluku uvek donosi server kroz `requireEventAccess` - skrivanje dugmeta
 * nikad nije zaštita (zahtev 24, poslednji red).
 */
export const PERMISSIONS = [
  'event:view',
  'event:edit',
  'event:delete',
  'invitation:edit',
  'invitation:publish',
  'guests:view',
  'guests:edit',
  'rsvp:view',
  'rsvp:manage',
  'seating:view',
  'seating:edit',
  'collaborators:manage',
  'billing:manage',
  'analytics:view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Uloga u kontekstu jednog događaja. */
export type EventRole = 'owner' | 'editor' | 'guest_manager' | 'viewer';

const OWNER_PERMISSIONS: readonly Permission[] = PERMISSIONS;

const EDITOR_PERMISSIONS: readonly Permission[] = [
  'event:view',
  'event:edit',
  'invitation:edit',
  'guests:view',
  'rsvp:view',
  'seating:view',
  'seating:edit',
  'analytics:view',
];

const GUEST_MANAGER_PERMISSIONS: readonly Permission[] = [
  'event:view',
  'guests:view',
  'guests:edit',
  'rsvp:view',
  'rsvp:manage',
  'seating:view',
  'seating:edit',
];

const VIEWER_PERMISSIONS: readonly Permission[] = [
  'event:view',
  'guests:view',
  'rsvp:view',
  'seating:view',
];

export const ROLE_PERMISSIONS: Record<EventRole, readonly Permission[]> = {
  owner: OWNER_PERMISSIONS,
  editor: EDITOR_PERMISSIONS,
  guest_manager: GUEST_MANAGER_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

export function roleHasPermission(
  role: EventRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Objavljivanje i naplata su namerno rezervisani za vlasnika: saradnik može da
 * uređuje sadržaj, ali ne i da pokrene plaćanje ili obriše događaj.
 */
export const OWNER_ONLY_PERMISSIONS: readonly Permission[] = [
  'event:delete',
  'invitation:publish',
  'collaborators:manage',
  'billing:manage',
];
