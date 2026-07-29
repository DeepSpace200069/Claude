'use client';

import { useId, useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

/**
 * Tabovi uređivača (zahtev 3.13 i 31).
 *
 * Zašto ručno, a ne gotova komponenta: panel uređivača mora da bude
 * **istovremeno** tab na telefonu i stalno vidljiva kolona na širokom ekranu.
 * Gotove implementacije to rešavaju atributom `hidden`, koji ne razlikuje
 * širinu ekrana - kolona bi na desktopu ostala sakrivena za čitač ekrana i kad
 * je vidljiva očima.
 *
 * Zato panelima ovde upravlja isključivo CSS (`display: none`), koji uklanja
 * element i iz stabla pristupačnosti tačno kada ga ukloni i sa ekrana. Struktura
 * je pritom identična na serveru i na klijentu, pa nema ni razlike u hidraciji
 * ni ostataka starog rasporeda u DOM-u.
 */
export type EditorTab = 'sadrzaj' | 'izgled' | 'pregled';

export type TabDefinition = {
  value: EditorTab;
  label: string;
  /** Tab koji na širokom ekranu nema smisla (pregled je tamo uvek vidljiv). */
  hideOnWide?: boolean;
  /**
   * Identifikatori panela kojima tab upravlja, razdvojeni razmakom.
   *
   * „Sadržaj" pokriva dva panela - listu sekcija i podešavanja izabrane
   * sekcije - jer na širokom ekranu stoje u dve kolone, a na telefonu jedan
   * ispod drugog. `aria-controls` prima više vrednosti upravo za ovakav slučaj.
   */
  controls?: string;
};

export function EditorTabBar({
  tabs,
  value,
  onChange,
  label,
  panelId,
}: {
  tabs: readonly TabDefinition[];
  value: EditorTab;
  onChange: (value: EditorTab) => void;
  label: string;
  panelId: (tab: EditorTab) => string;
}) {
  const refs = useRef(new Map<EditorTab, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const order = tabs.map((tab) => tab.value);
    const index = order.indexOf(value);
    if (index < 0) return;

    const next =
      event.key === 'ArrowRight'
        ? order[(index + 1) % order.length]
        : event.key === 'ArrowLeft'
          ? order[(index - 1 + order.length) % order.length]
          : event.key === 'Home'
            ? order[0]
            : event.key === 'End'
              ? order[order.length - 1]
              : undefined;

    if (!next) return;
    event.preventDefault();
    onChange(next);
    refs.current.get(next)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-1 rounded-full bg-muted p-1"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          ref={(node) => {
            if (node) refs.current.set(tab.value, node);
            else refs.current.delete(tab.value);
          }}
          type="button"
          role="tab"
          id={`${panelId(tab.value)}-tab`}
          aria-selected={value === tab.value}
          aria-controls={tab.controls ?? panelId(tab.value)}
          // Samo aktivni tab je u redosledu tabulatora; ostali se dobijaju
          // strelicama, kako nalaže obrazac za tabove.
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
            value === tab.value
              ? 'bg-surface text-foreground shadow-soft'
              : 'text-muted-foreground hover:text-foreground',
            tab.hideOnWide && 'lg:hidden',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Jedinstven prefiks identifikatora panela za jednu instancu uređivača. */
export function useTabIds(): (tab: EditorTab) => string {
  const id = useId();
  return (tab) => `${id}-${tab}`;
}
