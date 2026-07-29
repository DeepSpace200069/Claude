import { describe, expect, it } from 'vitest';

import { EDITABLE_SECTION_TYPES } from '@/features/editor/editors';
import { RENDERABLE_SECTION_TYPES } from '@/features/sections/renderers';
import { SECTION_TYPES } from '@/features/sections/registry';

/**
 * Tri registra moraju da ostanu usklađena: definicija, renderer i editor.
 *
 * Bez ove provere bi nova sekcija mogla da se pojavi u biblioteci, a da nema
 * editor - korisnik bi je dodao i video prazan panel. Test hvata baš taj
 * propust, i to pri dodavanju, a ne u produkciji.
 */
describe('registri sekcija', () => {
  it('svaki tip iz registra ima renderer', () => {
    const missing = SECTION_TYPES.filter(
      (type) => !RENDERABLE_SECTION_TYPES.includes(type),
    );
    expect(missing).toEqual([]);
  });

  it('svaki tip iz registra ima editor', () => {
    const missing = SECTION_TYPES.filter(
      (type) => !EDITABLE_SECTION_TYPES.includes(type),
    );
    expect(missing).toEqual([]);
  });

  it('nema editora za tip koji ne postoji u registru', () => {
    const extra = EDITABLE_SECTION_TYPES.filter(
      (type) => !SECTION_TYPES.includes(type),
    );
    expect(extra).toEqual([]);
  });
});
