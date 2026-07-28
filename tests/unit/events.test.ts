import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DETAIL_FIELDS,
  eventDetailsSchema,
  missingRequiredDetails,
  suggestEventName,
} from '@/features/events/details';
import {
  createEventSchema,
  fromInstant,
  toInstant,
  updateEventSchema,
} from '@/features/events/schemas';
import { randomPin, randomToken, hashToken, safeCompare } from '@/lib/ids';

describe('podaci događaja', () => {
  it('prihvata poznata polja', () => {
    const result = eventDetailsSchema.safeParse({
      partner1Name: 'Milica',
      partner2Name: 'Stefan',
    });
    expect(result.success).toBe(true);
  });

  it('odbija nepoznata polja', () => {
    const result = eventDetailsSchema.safeParse({ nepoznato: 'vrednost' });
    expect(result.success).toBe(false);
  });

  it('odbija datum u pogrešnom formatu', () => {
    const result = eventDetailsSchema.safeParse({ birthDate: '12.05.2025.' });
    expect(result.success).toBe(false);
  });

  it('svaki tip događaja ima definisana polja koja prolaze šemu', () => {
    /** Vrednost odgovarajućeg tipa za svako polje. */
    const sampleFor = (field: string): string | number => {
      if (field === 'turningAge') return 18;
      if (field === 'birthDate') return '2025-04-18';
      return 'Test';
    };

    for (const [key, fields] of Object.entries(DEFAULT_DETAIL_FIELDS)) {
      expect(Array.isArray(fields), `Tip "${key}" nema listu polja.`).toBe(true);
      expect(fields.length, `Tip "${key}" nema nijedno polje.`).toBeGreaterThan(0);

      const parsed = eventDetailsSchema.safeParse(
        Object.fromEntries(fields.map((field) => [field, sampleFor(field)])),
      );
      expect(parsed.success, `Polja tipa "${key}" ne prolaze šemu.`).toBe(true);
    }
  });
});

describe('predlog naziva', () => {
  it('spaja imena mladenaca', () => {
    expect(
      suggestEventName('wedding', { partner1Name: 'Milica', partner2Name: 'Stefan' }, 'rezerva'),
    ).toBe('Milica i Stefan');
  });

  it('radi i sa jednim unetim imenom', () => {
    expect(suggestEventName('wedding', { partner1Name: 'Milica' }, 'rezerva')).toBe('Milica');
  });

  it('koristi ime deteta za krštenje', () => {
    expect(suggestEventName('christening', { childName: 'Dunja' }, 'rezerva')).toBe('Dunja');
  });

  it('pada na rezervnu vrednost kada nema podataka', () => {
    expect(suggestEventName('wedding', {}, 'Nova pozivnica')).toBe('Nova pozivnica');
  });
});

describe('provera obaveznih podataka pre objavljivanja', () => {
  it('prijavljuje polja koja nedostaju', () => {
    const missing = missingRequiredDetails(
      ['partner1Name', 'partner2Name'],
      { partner1Name: 'Milica' },
    );
    expect(missing).toEqual(['partner2Name']);
  });

  it('prazan string se računa kao nedostajuće', () => {
    expect(missingRequiredDetails(['childName'], { childName: '' })).toEqual(['childName']);
  });

  it('vraća praznu listu kada je sve popunjeno', () => {
    expect(
      missingRequiredDetails(['partner1Name'], { partner1Name: 'Milica' }),
    ).toEqual([]);
  });
});

describe('konverzija datuma i vremena', () => {
  it('tumači vreme u zoni događaja', () => {
    // 12.09.2026. je letnje računanje vremena: Beograd je UTC+2.
    const instant = toInstant('2026-09-12', '13:00', 'Europe/Belgrade');
    expect(instant?.toISOString()).toBe('2026-09-12T11:00:00.000Z');
  });

  it('poštuje zimsko računanje vremena', () => {
    // 12.01.2026. je zimsko računanje: Beograd je UTC+1.
    const instant = toInstant('2026-01-12', '13:00', 'Europe/Belgrade');
    expect(instant?.toISOString()).toBe('2026-01-12T12:00:00.000Z');
  });

  it('radi i za druge zone', () => {
    const instant = toInstant('2026-09-12', '13:00', 'UTC');
    expect(instant?.toISOString()).toBe('2026-09-12T13:00:00.000Z');
  });

  it('bez vremena koristi ponoć', () => {
    const instant = toInstant('2026-09-12', undefined, 'Europe/Belgrade');
    expect(instant?.toISOString()).toBe('2026-09-11T22:00:00.000Z');
  });

  it('bez datuma vraća null', () => {
    expect(toInstant(undefined, '13:00', 'Europe/Belgrade')).toBeNull();
  });

  it('povratna konverzija vraća iste vrednosti', () => {
    const instant = toInstant('2026-09-12', '13:00', 'Europe/Belgrade');
    expect(fromInstant(instant, 'Europe/Belgrade')).toEqual({
      date: '2026-09-12',
      time: '13:00',
    });
  });

  it('fromInstant za null vraća prazne vrednosti', () => {
    expect(fromInstant(null, 'Europe/Belgrade')).toEqual({ date: '', time: '' });
  });
});

describe('šema kreiranja događaja', () => {
  const valid = {
    eventTypeId: '3f2a6c1e-4b7d-4a91-9e2b-8c5d0f1a2b3c',
    name: 'Milica i Stefan',
    details: { partner1Name: 'Milica' },
    date: '2026-09-12',
    time: '13:00',
    timeZone: 'Europe/Belgrade',
    city: 'Beograd',
    venueName: '',
    primaryLocale: 'sr-Latn' as const,
  };

  it('prihvata ispravan unos', () => {
    expect(createEventSchema.safeParse(valid).success).toBe(true);
  });

  it('odbija naziv kraći od dva znaka', () => {
    expect(createEventSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
  });

  it('odbija neispravan UUID tipa događaja', () => {
    expect(createEventSchema.safeParse({ ...valid, eventTypeId: 'ne-uuid' }).success).toBe(false);
  });

  it('odbija nepostojeću vremensku zonu', () => {
    expect(
      createEventSchema.safeParse({ ...valid, timeZone: 'Mars/Olympus' }).success,
    ).toBe(false);
  });

  it('odbija neispravno vreme', () => {
    expect(createEventSchema.safeParse({ ...valid, time: '25:99' }).success).toBe(false);
  });

  it('dozvoljava prazan datum (nacrt sme biti nepotpun)', () => {
    expect(createEventSchema.safeParse({ ...valid, date: '', time: '' }).success).toBe(true);
  });

  it('šema izmene zahteva id', () => {
    expect(updateEventSchema.safeParse({ ...valid, secondaryLocale: null }).success).toBe(false);
    expect(
      updateEventSchema.safeParse({
        ...valid,
        id: '9a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
        secondaryLocale: null,
      }).success,
    ).toBe(true);
  });
});

describe('tokeni gostiju', () => {
  it('token ima očekivanu dužinu i abecedu', () => {
    const token = randomToken();
    expect(token).toHaveLength(26);
    expect(token).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/);
  });

  it('tokeni se ne ponavljaju', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => randomToken()));
    expect(tokens.size).toBe(500);
  });

  it('ne sadrži znakove koji se lako mešaju', () => {
    const generated = Array.from({ length: 200 }, () => randomToken()).join('');
    for (const char of ['I', 'L', 'O', 'U']) {
      expect(generated).not.toContain(char);
    }
  });

  it('heš je stabilan i ne otkriva token', () => {
    const token = randomToken();
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it('safeCompare poredi tačno', () => {
    expect(safeCompare('tajna', 'tajna')).toBe(true);
    expect(safeCompare('tajna', 'tajna2')).toBe(false);
    expect(safeCompare('tajna', '')).toBe(false);
  });

  it('PIN je numerički i zadate dužine', () => {
    expect(randomPin(6)).toMatch(/^\d{6}$/);
  });
});
