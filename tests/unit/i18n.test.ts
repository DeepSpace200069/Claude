import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE, LOCALES, isLocale, resolveLocale } from '@/i18n/config';
import { daysUntil, formatCurrency, formatDate, formatTime } from '@/i18n/format';
import de from '@/i18n/messages/de';
import en from '@/i18n/messages/en';
import srCyrl from '@/i18n/messages/sr-Cyrl';
import srLatn from '@/i18n/messages/sr-Latn';
import type { Messages } from '@/i18n/messages';
import { createTranslator, type MessageTree } from '@/i18n/translator';

describe('razrešavanje jezika', () => {
  it('prepoznaje podržane jezike', () => {
    for (const locale of LOCALES) expect(isLocale(locale)).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('bira tačno poklapanje iz Accept-Language', () => {
    expect(resolveLocale('de,en;q=0.8')).toBe('de');
    expect(resolveLocale('en-GB,en;q=0.9')).toBe('en');
  });

  it('poštuje q vrednosti', () => {
    expect(resolveLocale('en;q=0.3,de;q=0.9')).toBe('de');
  });

  it('srpski bez skripta ide na latinicu', () => {
    expect(resolveLocale('sr')).toBe('sr-Latn');
    expect(resolveLocale('sr-RS')).toBe('sr-Latn');
  });

  it('srpski sa ćiriličnim skriptom ide na ćirilicu', () => {
    expect(resolveLocale('sr-Cyrl-RS')).toBe('sr-Cyrl');
  });

  it('nepoznat jezik pada na podrazumevani', () => {
    expect(resolveLocale('ja,ko;q=0.8')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
  });
});

describe('katalozi prevoda', () => {
  const catalogs: Array<[string, MessageTree]> = [
    ['sr-Latn', srLatn as unknown as MessageTree],
    ['sr-Cyrl', srCyrl as unknown as MessageTree],
    ['en', en as unknown as MessageTree],
    ['de', de as unknown as MessageTree],
  ];

  /** Sakuplja sve ključeve u obliku "a.b.c". */
  function collectKeys(tree: MessageTree, prefix = ''): string[] {
    return Object.entries(tree).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'string') return [path];
      if (value && typeof value === 'object' && 'other' in value) return [path];
      return collectKeys(value as MessageTree, path);
    });
  }

  const sourceKeys = collectKeys(srLatn as unknown as MessageTree).sort();

  it.each(catalogs)('katalog %s ima iste ključeve kao izvorni', (name, catalog) => {
    const keys = collectKeys(catalog).sort();
    const missing = sourceKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !sourceKeys.includes(key));

    expect(missing, `Katalogu "${name}" nedostaju ključevi.`).toEqual([]);
    expect(extra, `Katalog "${name}" ima višak ključeva.`).toEqual([]);
  });

  it('nijedna vrednost nije prazna', () => {
    for (const [name, catalog] of catalogs) {
      const values = collectKeys(catalog).map((key) =>
        key.split('.').reduce<unknown>((node, part) => (node as MessageTree)[part], catalog),
      );

      for (const value of values) {
        if (typeof value === 'string') {
          expect(value.trim().length, `Prazan prevod u katalogu "${name}".`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('prevodilac', () => {
  const t = createTranslator<Messages>('sr-Latn', srLatn as unknown as Messages);

  it('vraća prevod za poznat ključ', () => {
    expect(t('common.save')).toBe('Sačuvaj');
  });

  it('vraća sam ključ kada prevod ne postoji', () => {
    // Ključ je namerno nepoznat tipovima - proverava se ponašanje u vreme
    // izvršavanja, kada ključ dolazi iz baze ili iz starijeg sadržaja.
    expect(t.dynamic('ne.postoji.kljuc')).toBe('ne.postoji.kljuc');
  });

  it('interpolira parametre', () => {
    expect(t('wizard.stepOf', { current: 2, total: 3 })).toBe('Korak 2 od 3');
  });

  it('ostavlja neprosleđeni parametar netaknut', () => {
    expect(t('wizard.stepOf', { current: 2 })).toContain('{total}');
  });

  it('bira srpski oblik množine', () => {
    expect(t('events.countLabel', { count: 1 })).toBe('1 događaj');
    expect(t('events.countLabel', { count: 3 })).toBe('3 događaja');
    expect(t('events.countLabel', { count: 5 })).toBe('5 događaja');
    expect(t('events.countLabel', { count: 21 })).toBe('21 događaj');
  });

  it('engleski koristi svoja pravila množine', () => {
    const te = createTranslator<Messages>('en', en as unknown as Messages);
    expect(te('events.countLabel', { count: 1 })).toBe('1 event');
    expect(te('events.countLabel', { count: 3 })).toBe('3 events');
  });

  it('čita ključ iz prostora imena koji sadrži polje "other"', () => {
    // `eventTypes` ima vrstu proslave "other"; provera množine ne sme da
    // proglasi ceo prostor imena oblicima množine i sakrije njegov sadržaj.
    expect(t('eventTypes.wedding')).toBe('Venčanje');
    expect(t('eventTypes.other')).toBe('Ostalo');
    expect(t.dynamic('eventTypes.firstBirthday')).toBe('Prvi rođendan');
  });

  it('t.dynamic radi za ključeve poznate tek u vreme izvršavanja', () => {
    const key = ['eventStatus', 'published'].join('.');
    expect(t.dynamic(key)).toBe('Objavljeno');
  });

  it('pada na podrazumevani katalog za nedostajući ključ', () => {
    const partial = createTranslator<Messages>(
      'en',
      { common: { save: 'Save' } } as unknown as Messages,
      srLatn as unknown as MessageTree,
    );
    expect(partial('common.save')).toBe('Save');
    expect(partial('common.cancel')).toBe('Otkaži');
  });
});

describe('formatiranje', () => {
  const instant = new Date('2026-09-12T11:00:00Z');

  it('datum poštuje jezik', () => {
    expect(formatDate(instant, 'sr-Latn')).toMatch(/2026/);
    expect(formatDate(instant, 'de')).toMatch(/2026/);
  });

  it('vreme se prikazuje u zoni događaja, ne servera', () => {
    expect(formatTime(instant, 'sr-Latn', { timeZone: 'Europe/Belgrade' })).toBe('13:00');
    expect(formatTime(instant, 'sr-Latn', { timeZone: 'UTC' })).toBe('11:00');
  });

  it('valuta se formatira po jeziku', () => {
    expect(formatCurrency(290000, 'RSD', 'sr-Latn')).toContain('2.900');
  });

  it('daysUntil računa kalendarske dane', () => {
    const from = new Date('2026-09-10T05:00:00Z');
    const target = new Date('2026-09-12T05:00:00Z');
    expect(daysUntil(target, from, 'Europe/Belgrade')).toBe(2);
  });

  it('daysUntil računa dane u zoni događaja, ne u UTC', () => {
    // 22:00 UTC 10. septembra je već 11. septembar u Beogradu (UTC+2),
    // pa je do 12. septembra ostao jedan kalendarski dan, a ne dva.
    const from = new Date('2026-09-10T22:00:00Z');
    const target = new Date('2026-09-12T05:00:00Z');
    expect(daysUntil(target, from, 'Europe/Belgrade')).toBe(1);
    expect(daysUntil(target, from, 'UTC')).toBe(2);
  });

  it('daysUntil vraća 0 na dan događaja', () => {
    const from = new Date('2026-09-12T06:00:00Z');
    const target = new Date('2026-09-12T18:00:00Z');
    expect(daysUntil(target, from, 'Europe/Belgrade')).toBe(0);
  });

  it('daysUntil vraća negativnu vrednost za prošlost', () => {
    const from = new Date('2026-09-14T06:00:00Z');
    const target = new Date('2026-09-12T18:00:00Z');
    expect(daysUntil(target, from, 'Europe/Belgrade')).toBe(-2);
  });
});
