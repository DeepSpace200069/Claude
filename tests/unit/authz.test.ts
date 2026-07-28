import { describe, expect, it } from 'vitest';

import {
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHasPermission,
  type EventRole,
} from '@/server/authz/permissions';

describe('matrica dozvola', () => {
  it('vlasnik ima sve dozvole', () => {
    for (const permission of PERMISSIONS) {
      expect(roleHasPermission('owner', permission)).toBe(true);
    }
  });

  it('saradnik-urednik uređuje sadržaj, ali ne objavljuje i ne briše', () => {
    expect(roleHasPermission('editor', 'invitation:edit')).toBe(true);
    expect(roleHasPermission('editor', 'event:edit')).toBe(true);
    expect(roleHasPermission('editor', 'invitation:publish')).toBe(false);
    expect(roleHasPermission('editor', 'event:delete')).toBe(false);
    expect(roleHasPermission('editor', 'billing:manage')).toBe(false);
  });

  it('saradnik za goste upravlja gostima, ali ne menja pozivnicu', () => {
    expect(roleHasPermission('guest_manager', 'guests:edit')).toBe(true);
    expect(roleHasPermission('guest_manager', 'rsvp:manage')).toBe(true);
    expect(roleHasPermission('guest_manager', 'invitation:edit')).toBe(false);
    expect(roleHasPermission('guest_manager', 'event:edit')).toBe(false);
  });

  it('posmatrač ne može ništa da menja', () => {
    const writePermissions = PERMISSIONS.filter((p) => !p.endsWith(':view'));
    for (const permission of writePermissions) {
      expect(
        roleHasPermission('viewer', permission),
        `Posmatrač ne sme da ima "${permission}".`,
      ).toBe(false);
    }
  });

  it('nijedna saradnička uloga nema dozvole rezervisane za vlasnika', () => {
    const collaboratorRoles: EventRole[] = ['editor', 'guest_manager', 'viewer'];

    for (const role of collaboratorRoles) {
      for (const permission of OWNER_ONLY_PERMISSIONS) {
        expect(
          ROLE_PERMISSIONS[role].includes(permission),
          `Uloga "${role}" ne sme da ima "${permission}".`,
        ).toBe(false);
      }
    }
  });

  it('svaka dozvola iz liste je nekome dodeljena', () => {
    for (const permission of PERMISSIONS) {
      const holders = (Object.keys(ROLE_PERMISSIONS) as EventRole[]).filter((role) =>
        roleHasPermission(role, permission),
      );
      expect(holders.length, `Dozvola "${permission}" nije dodeljena nijednoj ulozi.`).toBeGreaterThan(0);
    }
  });
});
