'use client';

/**
 * Dugme koje otvara dijalog za štampu.
 *
 * Jedina interaktivna stvar na stranici za štampu, pa nosi i jedini JavaScript
 * na njoj. Na papiru se ne vidi (`stampa.css`), jer odštampano dugme „Odštampaj"
 * nema smisla.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="stampa__stampaj mt-3 rounded border border-current px-4 py-2 text-sm"
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
