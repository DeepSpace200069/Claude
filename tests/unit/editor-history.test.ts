import { describe, expect, it } from 'vitest';

import {
  COALESCE_MS,
  MAX_HISTORY,
  canRedo,
  canUndo,
  commit,
  createHistory,
  redo,
  replacePresent,
  undo,
} from '@/features/editor/history';

/**
 * Istorija je obična struktura vrednosti, pa se testira bez ikakvog okruženja.
 * Vreme se zadaje eksplicitno (`now`) da test ne bi zavisio od brzine mašine.
 */
describe('poništi i ponovi', () => {
  it('prazna istorija nema šta da poništi ni da ponovi', () => {
    const history = createHistory('a');
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('vraća prethodno stanje i omogućava ponavljanje', () => {
    let history = createHistory('a');
    history = commit(history, 'b');
    history = commit(history, 'c');

    expect(history.present).toBe('c');

    history = undo(history);
    expect(history.present).toBe('b');
    expect(canRedo(history)).toBe(true);

    history = undo(history);
    expect(history.present).toBe('a');
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present).toBe('b');
    history = redo(history);
    expect(history.present).toBe('c');
    expect(canRedo(history)).toBe(false);
  });

  it('nova izmena posle poništavanja odbacuje granu koja se više ne može ponoviti', () => {
    let history = createHistory('a');
    history = commit(history, 'b');
    history = undo(history);
    history = commit(history, 'c');

    expect(canRedo(history)).toBe(false);
    expect(history.present).toBe('c');
    expect(history.past).toEqual(['a']);
  });
});

describe('objedinjavanje uzastopnih izmena', () => {
  it('kucanje u istom polju je jedan korak istorije', () => {
    let history = createHistory('');
    history = commit(history, 'A', { label: 'hero:title', now: 1000 });
    history = commit(history, 'An', { label: 'hero:title', now: 1100 });
    history = commit(history, 'Ana', { label: 'hero:title', now: 1200 });

    expect(history.past).toHaveLength(1);
    expect(undo(history).present).toBe('');
  });

  it('prelazak na drugo polje pravi novi korak', () => {
    let history = createHistory('');
    history = commit(history, 'A', { label: 'hero:title', now: 1000 });
    history = commit(history, 'A|B', { label: 'hero:subtitle', now: 1050 });

    expect(history.past).toHaveLength(2);
    expect(undo(history).present).toBe('A');
  });

  it('pauza duža od praga prekida objedinjavanje', () => {
    let history = createHistory('');
    history = commit(history, 'A', { label: 'hero:title', now: 1000 });
    history = commit(history, 'AB', {
      label: 'hero:title',
      now: 1000 + COALESCE_MS + 1,
    });

    expect(history.past).toHaveLength(2);
  });

  it('izmene bez oznake se nikad ne spajaju', () => {
    let history = createHistory('a');
    history = commit(history, 'b', { now: 1000 });
    history = commit(history, 'c', { now: 1001 });

    expect(history.past).toEqual(['a', 'b']);
  });

  it('poništi posle objedinjavanja ne nastavlja da spaja', () => {
    let history = createHistory('');
    history = commit(history, 'A', { label: 'hero:title', now: 1000 });
    history = undo(history);
    history = commit(history, 'X', { label: 'hero:title', now: 1050 });

    // Oznaka je resetovana pri poništavanju, pa je ovo nov korak.
    expect(history.past).toHaveLength(1);
  });
});

describe('granice istorije', () => {
  it('broj koraka je ograničen, a najstariji se odbacuju', () => {
    let history = createHistory(0);

    for (let step = 1; step <= MAX_HISTORY + 10; step += 1) {
      history = commit(history, step);
    }

    expect(history.past).toHaveLength(MAX_HISTORY);
    // Najstarija zapamćena vrednost više nije početna nula.
    expect(history.past[0]).toBe(10);
  });

  it('replacePresent menja stanje bez novog koraka', () => {
    let history = createHistory('a');
    history = commit(history, 'b');
    const replaced = replacePresent(history, 'b-sa-servera');

    expect(replaced.present).toBe('b-sa-servera');
    expect(replaced.past).toEqual(history.past);
    expect(replaced.lastLabel).toBeNull();
  });
});
