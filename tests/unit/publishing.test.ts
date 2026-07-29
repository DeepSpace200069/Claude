import { describe, expect, it } from 'vitest';

import { privacySettingsSchema } from '@/features/invitations/schemas';
import { endOfDayInZone } from '@/server/services/publishing';
import { formatDayInZone } from '@/server/services/public-invitation';

/**
 * Datum isteka i dan statistike su čista računica nad vremenskim zonama, pa se
 * testiraju bez baze. Greška od jednog sata ovde znači da pozivnica prestane da
 * važi dan ranije nego što organizator misli.
 */
describe('kraj dana u vremenskoj zoni', () => {
  it('pozivnica važi do kraja izabranog dana, a ne do ponoći po UTC-u', () => {
    // Beograd je leti UTC+2, pa je kraj 20. juna u 21:59:59 UTC.
    const end = endOfDayInZone('2027-06-20', 'Europe/Belgrade');

    expect(end.toISOString()).toBe('2027-06-20T21:59:59.000Z');
  });

  it('zimsko računanje vremena daje drugi pomeraj', () => {
    // Zimi je Beograd UTC+1: kraj 20. januara je u 22:59:59 UTC.
    const end = endOfDayInZone('2027-01-20', 'Europe/Belgrade');

    expect(end.toISOString()).toBe('2027-01-20T22:59:59.000Z');
  });

  it('zona sa drugim predznakom se takođe računa tačno', () => {
    const end = endOfDayInZone('2027-06-20', 'America/New_York');

    // New York je leti UTC-4, pa kraj dana pada tek sutradan po UTC-u.
    expect(end.toISOString()).toBe('2027-06-21T03:59:59.000Z');
  });

  it('nepoznata zona ne obara izračunavanje', () => {
    expect(() => endOfDayInZone('2027-06-20', 'Nepostojeca/Zona')).not.toThrow();
  });

  it('neispravan datum se odbija', () => {
    expect(() => endOfDayInZone('nije-datum', 'Europe/Belgrade')).toThrow();
  });
});

describe('dan za dnevni agregat', () => {
  it('računa se u zoni događaja, ne u zoni servera', () => {
    // 21:30 UTC je već sledeći dan u Beogradu (23:30) - ali ne i u Njujorku.
    const instant = new Date('2027-06-20T22:30:00.000Z');

    expect(formatDayInZone(instant, 'Europe/Belgrade')).toBe('2027-06-21');
    expect(formatDayInZone(instant, 'America/New_York')).toBe('2027-06-20');
  });

  it('nepoznata zona pada na UTC umesto da obori beleženje', () => {
    const instant = new Date('2027-06-20T22:30:00.000Z');
    expect(formatDayInZone(instant, 'Nepostojeca/Zona')).toBe('2027-06-20');
  });
});

describe('šema podešavanja privatnosti', () => {
  const base = {
    eventId: '11111111-2222-4333-8444-555555555555',
    privacy: 'unlisted' as const,
  };

  it('prazan PIN i prazan datum su dozvoljeni', () => {
    const result = privacySettingsSchema.safeParse(base);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pin).toBe('');
      expect(result.data.expiresOn).toBe('');
    }
  });

  it('PIN mora imati od 4 do 8 cifara', () => {
    expect(privacySettingsSchema.safeParse({ ...base, pin: '1234' }).success).toBe(true);
    expect(privacySettingsSchema.safeParse({ ...base, pin: '12345678' }).success).toBe(true);
    expect(privacySettingsSchema.safeParse({ ...base, pin: '123' }).success).toBe(false);
    expect(privacySettingsSchema.safeParse({ ...base, pin: '123456789' }).success).toBe(false);
    // Slova bi bila teška za diktiranje preko telefona.
    expect(privacySettingsSchema.safeParse({ ...base, pin: 'abcd' }).success).toBe(false);
  });

  it('datum isteka mora biti u obliku GGGG-MM-DD', () => {
    expect(
      privacySettingsSchema.safeParse({ ...base, expiresOn: '2027-06-20' }).success,
    ).toBe(true);
    expect(
      privacySettingsSchema.safeParse({ ...base, expiresOn: '20.06.2027.' }).success,
    ).toBe(false);
  });

  it('nepoznat režim privatnosti se odbija', () => {
    expect(
      privacySettingsSchema.safeParse({ ...base, privacy: 'svi-osim-svekrve' }).success,
    ).toBe(false);
  });
});
