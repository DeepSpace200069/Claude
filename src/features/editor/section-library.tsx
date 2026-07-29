'use client';

import { Lock, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FEATURE_FLAGS,
  can,
  type FeatureFlag,
} from '@/features/billing/entitlements';
import { listSectionsForEventType } from '@/features/sections/registry';
import type { SectionCategory, SectionDefinition } from '@/features/sections/types';
import { useTranslations } from '@/i18n/client';
import { cn } from '@/lib/utils';

import { useEditorConfig } from './context';
import { useEditorActions, useEditorDocument } from './store';

/**
 * Biblioteka sekcija (zahtev 3.3 i 8).
 *
 * Sadržaj dolazi iz registra: nova sekcija se pojavi ovde čim se doda njena
 * definicija, bez izmene ijedne komponente.
 *
 * Zaključane sekcije se **prikazuju**, a ne skrivaju - korisnik treba da zna šta
 * paket nudi. Onemogućeno dugme pritom nije zaštita: isti uslov se ponovo
 * proverava pri čuvanju na serveru (zahtev 24 i 39.9).
 */
const CATEGORY_ORDER: readonly SectionCategory[] = [
  'basics',
  'logistics',
  'story',
  'media',
  'interaction',
];

function isFeatureFlag(value: string): value is FeatureFlag {
  return (FEATURE_FLAGS as readonly string[]).includes(value);
}

export function SectionLibrary({ eventTypeKey }: { eventTypeKey: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const document = useEditorDocument();
  const actions = useEditorActions();
  const { entitlements } = useEditorConfig();

  const available = listSectionsForEventType(eventTypeKey);
  const usedTypes = new Set(document.sections.map((section) => section.type));

  const reasonFor = (definition: SectionDefinition<unknown>): string | null => {
    if (definition.singleton === true && usedTypes.has(definition.type)) {
      return t('editor.sections.singletonUsed');
    }
    const feature = definition.requiresFeature;
    if (feature && isFeatureFlag(feature) && !can(entitlements, feature)) {
      return t('editor.sections.locked');
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="w-full">
          <Plus aria-hidden />
          {t('editor.sections.add')}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('editor.sections.libraryTitle')}</DialogTitle>
          <DialogDescription>
            {t('editor.sections.libraryDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const group = available.filter(
              (definition) => definition.category === category,
            );
            if (group.length === 0) return null;

            return (
              <section key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.dynamic(`editor.categories.${category}`)}
                </h3>

                <ul className="grid gap-2 sm:grid-cols-2">
                  {group.map((definition) => {
                    const reason = reasonFor(definition);

                    return (
                      <li key={definition.type}>
                        <button
                          type="button"
                          disabled={reason !== null}
                          onClick={() => {
                            actions.addSection(definition.type);
                            setOpen(false);
                          }}
                          className={cn(
                            'flex h-full w-full flex-col gap-1 rounded-[var(--radius)] border p-3 text-left transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                            reason
                              ? 'cursor-not-allowed border-border bg-muted/40 opacity-70'
                              : 'border-border bg-surface hover:border-primary',
                          )}
                        >
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            {reason ? (
                              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
                            ) : null}
                            {t.dynamic(definition.labelKey)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {reason ?? t.dynamic(definition.descriptionKey)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
