'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import {
  assignGuestAction,
  createTableAction,
  moveTableAction,
  unassignGuestAction,
} from '@/server/actions/seating';
import type { SeatingPlanView, SeatingTable } from '@/server/services/seating';

import { clampToRoom } from './geometry';
import { GuestChip } from './guest-chip';
import { SeatSelect } from './seat-select';
import { TableCard } from './table-card';
import { TableInspector } from './table-inspector';
import { UnseatedPanel } from './unseated-panel';

const ZOOM_STEPS = [0.5, 0.75, 1] as const;

/**
 * Uređivač rasporeda sedenja (zahtev 14).
 *
 * Izvor istine je server: stranica se ponovo renderuje posle svake izmene koja
 * menja strukturu. Lokalno se pamti samo položaj stola dok se vuče, jer bi
 * osvežavanje cele stranice na svaki pomeraj učinilo platno trzavim.
 */
export function SeatingEditor({
  eventId,
  plan,
  canEdit,
}: {
  eventId: string;
  plan: SeatingPlanView;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [roomId, setRoomId] = useState(plan.rooms[0]?.id ?? '');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(0.75);
  const [overTableId, setOverTableId] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(
    {},
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const room = plan.rooms.find((candidate) => candidate.id === roomId) ?? plan.rooms[0];
  const disabled = !canEdit || plan.isLocked;

  const allTables = plan.rooms.flatMap((candidate) => candidate.tables);
  const selectedTable =
    allTables.find((table) => table.id === selectedTableId) ?? null;

  const positionOf = (table: SeatingTable) =>
    positions[table.id] ?? { x: table.x, y: table.y };

  const seatGuest = async (tableId: string, guestId: string): Promise<void> => {
    const result = await assignGuestAction({ eventId, tableId, guestId });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
  };

  const removeGuest = async (assignmentId: string): Promise<void> => {
    const result = await unassignGuestAction({ eventId, assignmentId });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    setOverTableId(null);

    const data = event.active.data.current;
    if (!data) return;

    if (data.type === 'guest') {
      const target = event.over?.data.current;
      if (target?.type === 'table-slot' && typeof target.tableId === 'string') {
        void seatGuest(target.tableId, data.guestId as string);
      }
      return;
    }

    if (data.type === 'table') {
      const tableId = data.tableId as string;
      const table = allTables.find((candidate) => candidate.id === tableId);
      if (!table) return;

      const home = plan.rooms.find((candidate) =>
        candidate.tables.some((entry) => entry.id === tableId),
      );
      if (!home) return;

      const base = positionOf(table);
      // Ista pravila kao na serveru: sto ostaje unutar sale.
      const next = clampToRoom(
        { x: base.x + event.delta.x / zoom, y: base.y + event.delta.y / zoom },
        table,
        home,
      );

      setPositions((current) => ({ ...current, [tableId]: next }));

      void moveTableAction({ eventId, tableId, ...next }).then((result) => {
        if (result.ok) return;

        toast.error(result.message);
        // Neuspeh znači da položaj nije sačuvan; vraćamo prikaz na stanje sa
        // servera umesto da ostavimo sto tamo gde nije.
        setPositions((current) => {
          const { [tableId]: _removed, ...rest } = current;
          return rest;
        });
      });
    }
  };

  const handleDragOver = (event: DragOverEvent): void => {
    const target = event.over?.data.current;
    setOverTableId(
      target?.type === 'table-slot' && typeof target.tableId === 'string'
        ? target.tableId
        : null,
    );
  };

  const addTable = async (): Promise<void> => {
    if (!room) return;

    const result = await createTableAction({
      eventId,
      roomId: room.id,
      table: {
        name: `Sto ${room.tables.length + 1}`,
        shape: 'round',
        capacity: 8,
        x: 80 + (room.tables.length % 4) * 200,
        y: 80 + Math.floor(room.tables.length / 4) * 200,
        width: 140,
        height: 140,
        rotation: 0,
        notes: '',
      },
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setSelectedTableId(result.data.tableId);
    router.refresh();
  };

  const tableOptions = allTables.map((table) => ({
    id: table.id,
    name: table.name,
    isFull: table.guests.length >= table.capacity,
  }));

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/*
          `min-w-0` je ovde neophodan, a ne kozmetika: podrazumevani
          `min-width: auto` ne dozvoljava koloni da bude uža od svog sadržaja, pa
          bi platno sale od devetsto piksela razvuklo **celu stranicu** na
          telefonu. Ovako se platno pomera unutar svog okvira, a stranica ne.
        */}
        <div className="min-w-0 space-y-3">
          {plan.isLocked ? (
            <Alert tone="warning">{t('seating.lockedNotice')}</Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {plan.rooms.length > 1 ? (
              <div className="flex flex-wrap gap-1" role="tablist" aria-label={t('seating.roomsTitle')}>
                {plan.rooms.map((candidate) => (
                  <Button
                    key={candidate.id}
                    size="sm"
                    role="tab"
                    aria-selected={candidate.id === room?.id}
                    variant={candidate.id === room?.id ? 'primary' : 'secondary'}
                    onClick={() => setRoomId(candidate.id)}
                  >
                    {candidate.name}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                disabled={zoom <= ZOOM_STEPS[0]}
                onClick={() =>
                  setZoom((current) => stepZoom(current, -1))
                }
              >
                <ZoomOut aria-hidden />
                <span className="sr-only">−</span>
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="icon"
                variant="ghost"
                disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]!}
                onClick={() => setZoom((current) => stepZoom(current, 1))}
              >
                <ZoomIn aria-hidden />
                <span className="sr-only">+</span>
              </Button>

              <Button size="sm" onClick={() => void addTable()} disabled={disabled}>
                <Plus aria-hidden />
                {t('seating.addTable')}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('seating.dragHint')}</p>

          {room ? (
            <div className="overflow-auto rounded-[var(--radius-lg)] border border-border bg-muted/30 p-4">
              <div
                className="relative rounded-[var(--radius)] border border-dashed border-border bg-surface"
                style={{ width: room.width * zoom, height: room.height * zoom }}
              >
                {room.tables.map((table) => {
                  const position = positionOf(table);

                  return (
                    <TableCard
                      key={table.id}
                      table={table}
                      x={position.x}
                      y={position.y}
                      zoom={zoom}
                      isSelected={table.id === selectedTableId}
                      isOver={table.id === overTableId}
                      disabled={disabled}
                      moveLabel={t('seating.tableSelected', { name: table.name })}
                      seatsLabel={t('seating.seatsUsed', {
                        seated: table.guests.length,
                        capacity: table.capacity,
                      })}
                      onSelect={() => setSelectedTableId(table.id)}
                    >
                      {table.guests.map((guest) => (
                        <GuestChip
                          key={guest.assignmentId}
                          guestId={guest.guestId}
                          name={guest.name}
                          isChild={guest.isChild}
                          needs={guest.needs}
                          dragDisabled={disabled}
                        >
                          <SeatSelect
                            label={t('seating.moveGuest', { name: guest.name })}
                            placeholder={t('seating.assignPlaceholder')}
                            removeLabel={t('seating.removeFromTable')}
                            tables={tableOptions.filter(
                              (option) => option.id !== table.id,
                            )}
                            disabled={disabled}
                            onSelect={(tableId) => void seatGuest(tableId, guest.guestId)}
                            onRemove={() => void removeGuest(guest.assignmentId)}
                          />
                        </GuestChip>
                      ))}
                    </TableCard>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <UnseatedPanel
            guests={plan.unseated}
            tables={tableOptions}
            disabled={disabled}
            onSeat={(tableId, guestId) => void seatGuest(tableId, guestId)}
          />

          <TableInspector
            eventId={eventId}
            table={selectedTable}
            disabled={disabled}
            onDeleted={() => setSelectedTableId(null)}
          />
        </div>
      </div>
    </DndContext>
  );
}

function stepZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_STEPS.indexOf(current as (typeof ZOOM_STEPS)[number]);
  const next = Math.min(
    ZOOM_STEPS.length - 1,
    Math.max(0, (index < 0 ? 1 : index) + direction),
  );
  return ZOOM_STEPS[next] ?? 0.75;
}
