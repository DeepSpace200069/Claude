'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  MoreVertical,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getSectionDefinition } from '@/features/sections/registry';
import { useTranslations } from '@/i18n/client';
import { cn } from '@/lib/utils';

import type { EditorSection } from './document';
import { useEditorActions, useEditorDocument, useEditorState } from './store';

/**
 * Lista sekcija sa promenom redosleda (zahtev 3.4 i 31).
 *
 * Prevlačenje je udobno mišem, ali ne sme da bude **jedini** način: svaka
 * sekcija ima i „pomeri gore" i „pomeri dole" u meniju, dnd-kit-ov tastaturni
 * senzor radi razmaknicom i strelicama, a svaka promena redosleda se izgovara
 * kroz `aria-live` područje. Korisnik bez miša zato ne gubi nijednu radnju.
 */
export function SectionList() {
  const t = useTranslations();
  const document = useEditorDocument();
  const { selectedSectionId } = useEditorState();
  const actions = useEditorActions();
  const [announcement, setAnnouncement] = useState('');

  const sensors = useSensors(
    // Mali prag sprečava da običan klik na sekciju bude protumačen kao
    // početak prevlačenja - inače bi izbor sekcije često „promašio".
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const nameOf = (section: EditorSection) => {
    const definition = getSectionDefinition(section.type);
    return definition ? t.dynamic(definition.labelKey) : section.type;
  };

  const announceMove = (section: EditorSection, position: number) => {
    setAnnouncement(
      t('editor.sections.movedTo', {
        name: nameOf(section),
        position: position + 1,
        total: document.sections.length,
      }),
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const toIndex = document.sections.findIndex((section) => section.id === over.id);
    const moved = document.sections.find((section) => section.id === active.id);
    if (!moved || toIndex < 0) return;

    actions.moveSection(String(active.id), toIndex);
    announceMove(moved, toIndex);
  };

  const nudge = (section: EditorSection, delta: number) => {
    const from = document.sections.findIndex((item) => item.id === section.id);
    const target = from + delta;
    if (target < 0 || target >= document.sections.length) return;

    actions.nudgeSection(section.id, delta);
    announceMove(section, target);
  };

  /*
   * dnd-kit izgovara sopstvene poruke tokom prevlačenja; bez ovoga bi bile na
   * engleskom, bez obzira na jezik interfejsa.
   */
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${String(active.id)}`,
    onDragOver: () => undefined,
    onDragEnd: ({ active, over }) => {
      if (!over) return undefined;
      const index = document.sections.findIndex((section) => section.id === over.id);
      const section = document.sections.find((item) => item.id === active.id);
      if (!section || index < 0) return undefined;
      return t('editor.sections.movedTo', {
        name: nameOf(section),
        position: index + 1,
        total: document.sections.length,
      });
    },
    onDragCancel: () => undefined,
  };

  if (document.sections.length === 0) {
    return (
      <p className="rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        {t('editor.sections.empty')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('editor.sections.reorderHint')}</p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        accessibility={{ announcements }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={document.sections.map((section) => section.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1.5">
            {document.sections.map((section, index) => (
              <SortableRow
                key={section.id}
                section={section}
                name={nameOf(section)}
                index={index}
                total={document.sections.length}
                isSelected={section.id === selectedSectionId}
                onSelect={() => actions.select(section.id)}
                onNudge={(delta) => nudge(section, delta)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Promena redosleda mora da bude čujna, ne samo vidljiva. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function SortableRow({
  section,
  name,
  index,
  total,
  isSelected,
  onSelect,
  onNudge,
}: {
  section: EditorSection;
  name: string;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  onNudge: (delta: number) => void;
}) {
  const t = useTranslations();
  const actions = useEditorActions();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const definition = getSectionDefinition(section.type);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-[var(--radius)] border bg-surface pr-1 transition-colors',
        isSelected ? 'border-primary ring-1 ring-ring/25' : 'border-border',
        isDragging && 'opacity-70 shadow-lifted',
      )}
    >
      <button
        type="button"
        aria-label={t('editor.sections.dragHandle')}
        className="flex size-9 shrink-0 cursor-grab items-center justify-center rounded-[var(--radius-xs)] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
        className="min-w-0 flex-1 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className="block truncate text-sm font-medium">{name}</span>
        {!section.isVisible ? (
          <span className="text-xs text-muted-foreground">
            {t('editor.sections.hidden')}
          </span>
        ) : null}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t('editor.sections.moreActions', { name })}
          className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <MoreVertical className="size-4" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={index === 0} onSelect={() => onNudge(-1)}>
            <ChevronUp aria-hidden />
            {t('editor.sections.moveUp')}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={index === total - 1}
            onSelect={() => onNudge(1)}
          >
            <ChevronDown aria-hidden />
            {t('editor.sections.moveDown')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => actions.setVisibility(section.id, !section.isVisible)}
          >
            {section.isVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            {section.isVisible ? t('editor.sections.hide') : t('editor.sections.show')}
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={definition?.singleton === true}
            onSelect={() => actions.duplicateSection(section.id)}
          >
            <Copy aria-hidden />
            {t('editor.sections.duplicate')}
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => actions.resetSection(section.id)}>
            <RotateCcw aria-hidden />
            {t('editor.sections.reset')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            destructive
            onSelect={() => actions.removeSection(section.id)}
          >
            <Trash2 aria-hidden />
            {t('editor.sections.remove')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
