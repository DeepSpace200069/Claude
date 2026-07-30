'use client';

import { Copy, Eraser, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, FieldControl } from '@/components/ui/field';
import { Alert } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { TABLE_SHAPES } from '@/features/seating/schemas';
import {
  clearTableAction,
  deleteTableAction,
  duplicateTableAction,
  updateTableAction,
} from '@/server/actions/seating';
import type { SeatingTable } from '@/server/services/seating';

/**
 * Podešavanja izabranog stola.
 *
 * Izmene se šalju tek na „Sačuvaj", a ne dok se kuca: naziv stola je jedinstven
 * u sali, pa bi čuvanje na svaki otkucani znak pravilo stolove „S", „St", „Sto".
 */
export function TableInspector({
  eventId,
  table,
  disabled,
  onDeleted,
}: {
  eventId: string;
  table: SeatingTable | null;
  disabled: boolean;
  onDeleted: () => void;
}) {
  const t = useTranslations();

  if (!table) {
    return (
      <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">{t('seating.tablesTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('seating.noTableSelected')}
        </p>
      </section>
    );
  }

  return (
    <TableForm
      key={table.id}
      eventId={eventId}
      table={table}
      disabled={disabled}
      onDeleted={onDeleted}
    />
  );
}

function TableForm({
  eventId,
  table,
  disabled,
  onDeleted,
}: {
  eventId: string;
  table: SeatingTable;
  disabled: boolean;
  onDeleted: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [name, setName] = useState(table.name);
  const [shape, setShape] = useState<SeatingTable['shape']>(table.shape);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [width, setWidth] = useState(String(table.width));
  const [height, setHeight] = useState(String(table.height));
  const [rotation, setRotation] = useState(String(table.rotation));
  const [notes, setNotes] = useState(table.notes ?? '');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await updateTableAction({
      eventId,
      tableId: table.id,
      table: { name, shape, capacity, width, height, rotation, notes, x: table.x, y: table.y },
    });

    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast.success(t('seating.saved'));
    router.refresh();
  };

  const selectClass =
    'h-11 w-full rounded-[var(--radius)] border border-input bg-surface px-3.5 text-base md:text-sm';

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4">
      <h2 className="text-sm font-medium">{table.name}</h2>

      <form onSubmit={submit} noValidate className="mt-3 space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}

        <Field label={t('seating.tableName')} required>
          <FieldControl>
            {(props) => (
              <Input
                {...props}
                value={name}
                disabled={disabled}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FieldControl>
        </Field>

        <Field label={t('seating.tableShape')}>
          <FieldControl>
            {(props) => (
              <select
                {...props}
                className={selectClass}
                value={shape}
                disabled={disabled}
                onChange={(event) =>
                  setShape(event.target.value as SeatingTable['shape'])
                }
              >
                {TABLE_SHAPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`seating.shape${shapeKey(value)}` as 'seating.shapeRound')}
                  </option>
                ))}
              </select>
            )}
          </FieldControl>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('seating.tableCapacity')}>
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={40}
                  value={capacity}
                  disabled={disabled}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>

          <Field label={t('seating.tableRotation')}>
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={0}
                  max={359}
                  step={15}
                  value={rotation}
                  disabled={disabled}
                  onChange={(event) => setRotation(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>

          <Field label={t('seating.tableWidth')}>
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={40}
                  max={800}
                  step={10}
                  value={width}
                  disabled={disabled}
                  onChange={(event) => setWidth(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>

          <Field label={t('seating.tableHeight')}>
            <FieldControl>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={40}
                  max={800}
                  step={10}
                  value={height}
                  disabled={disabled}
                  onChange={(event) => setHeight(event.target.value)}
                />
              )}
            </FieldControl>
          </Field>
        </div>

        <Field label={t('seating.tableNotes')} optionalLabel={t('common.optional')}>
          <FieldControl>
            {(props) => (
              <Textarea
                {...props}
                rows={2}
                value={notes}
                disabled={disabled}
                onChange={(event) => setNotes(event.target.value)}
              />
            )}
          </FieldControl>
        </Field>

        <Button type="submit" loading={pending} disabled={disabled} className="w-full">
          {t('common.save')}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={async () => {
            const result = await duplicateTableAction({ eventId, tableId: table.id });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            router.refresh();
          }}
        >
          <Copy aria-hidden />
          {t('seating.duplicateTable')}
        </Button>

        {table.guests.length > 0 ? (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="secondary" disabled={disabled}>
                <Eraser aria-hidden />
                {t('seating.clearTable')}
              </Button>
            }
            title={t('seating.clearTable')}
            description={t('seating.clearTableConfirm')}
            confirmLabel={t('common.confirm')}
            cancelLabel={t('common.cancel')}
            destructive={false}
            onConfirm={async () => {
              const result = await clearTableAction({ eventId, tableId: table.id });
              if (!result.ok) return result.message;
              router.refresh();
              return null;
            }}
          />
        ) : null}

        <ConfirmDialog
          trigger={
            <Button size="sm" variant="ghost" disabled={disabled}>
              <Trash2 aria-hidden />
              {t('seating.deleteTable')}
            </Button>
          }
          title={t('seating.deleteTable')}
          description={t('seating.deleteTableConfirm')}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          onConfirm={async () => {
            const result = await deleteTableAction({ eventId, tableId: table.id });
            if (!result.ok) return result.message;
            onDeleted();
            router.refresh();
            return null;
          }}
        />
      </div>
    </section>
  );
}

/** `round` → `Round`, radi sastavljanja ključa prevoda. */
function shapeKey(shape: string): string {
  return shape.charAt(0).toUpperCase() + shape.slice(1);
}
