'use client';

export type SeatTableOption = { id: string; name: string; isFull: boolean };

/**
 * Ravnopravna alternativa prevlačenju (zahtev 31).
 *
 * Jedna kontrola, bez dodatnog dugmeta: izbor stola odmah izvršava radnju. Lista
 * radi tastaturom, čitačem ekrana i na telefonu, gde je prevlačenje po platnu
 * ionako nezgodno.
 *
 * Pun sto ostaje u listi, ali je onemogućen - da organizator vidi da sto postoji
 * i zašto ne može tamo, umesto da se pita gde je nestao.
 */
export function SeatSelect({
  label,
  placeholder,
  removeLabel,
  tables,
  disabled,
  onSelect,
  onRemove,
}: {
  label: string;
  placeholder: string;
  /** Kada postoji, u listi je i opcija za uklanjanje sa stola. */
  removeLabel?: string;
  tables: readonly SeatTableOption[];
  disabled: boolean;
  onSelect: (tableId: string) => void;
  onRemove?: (() => void) | undefined;
}) {
  return (
    <select
      aria-label={label}
      disabled={disabled}
      value=""
      className="max-w-24 shrink-0 rounded-[var(--radius-xs)] border border-input bg-surface px-1 py-0.5 text-[0.6875rem]"
      onChange={(event) => {
        const value = event.target.value;
        if (value === '') return;
        if (value === '__ukloni') {
          onRemove?.();
          return;
        }
        onSelect(value);
      }}
    >
      <option value="">{placeholder}</option>

      {removeLabel && onRemove ? (
        <option value="__ukloni">{removeLabel}</option>
      ) : null}

      {tables.map((table) => (
        <option key={table.id} value={table.id} disabled={table.isFull}>
          {table.name}
        </option>
      ))}
    </select>
  );
}
