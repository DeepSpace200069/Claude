'use client';

import { Copy, Lock, LockOpen, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import {
  deleteVersionAction,
  duplicateVersionAction,
  renameVersionAction,
  setActiveVersionAction,
  setVersionLockAction,
} from '@/server/actions/seating';
import type { SeatingVersionSummary } from '@/server/services/seating';

/**
 * Verzije rasporeda (zahtev 14).
 *
 * Kopija je centralna radnja, a ne sporedna: organizator koji hoće da proba
 * drugačiji raspored ne sme da rizikuje onaj koji već radi. Zaključavanje je
 * druga strana iste ideje - kada je raspored dogovoren, zaključa se da ga
 * slučajan klik ne pomeri.
 */
export function VersionBar({
  eventId,
  versions,
  currentVersionId,
  isLocked,
  canEdit,
}: {
  eventId: string;
  versions: readonly SeatingVersionSummary[];
  currentVersionId: string;
  isLocked: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [label, setLabel] = useState('');
  const [pending, setPending] = useState(false);

  const current = versions.find((version) => version.id === currentVersionId);

  const run = async (
    action: () => Promise<{ ok: boolean; message?: string }>,
  ): Promise<void> => {
    setPending(true);
    const result = await action();
    setPending(false);

    if (!result.ok) {
      toast.error(result.message ?? t('errors.genericText'));
      return;
    }
    router.refresh();
  };

  return (
    <section
      aria-labelledby="verzije-rasporeda"
      className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
    >
      <h2 id="verzije-rasporeda" className="text-sm font-medium">
        {t('seating.versionsTitle')}
      </h2>

      <ul className="mt-3 space-y-1.5">
        {versions.map((version) => (
          <li
            key={version.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">
                {version.label ?? t('seating.versionName', { number: version.version })}
                {version.isActive ? (
                  <Badge variant="primary" className="ml-2">
                    {t('seating.activeVersion')}
                  </Badge>
                ) : null}
                {version.isLocked ? (
                  <Badge variant="neutral" className="ml-2">
                    <Lock className="size-3" aria-hidden />
                    {t('seating.lockVersion')}
                  </Badge>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('seating.versionSummary', {
                  tables: version.tableCount,
                  seated: version.seatedCount,
                })}
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              {version.isActive ? null : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || !canEdit}
                  onClick={() =>
                    void run(() =>
                      setActiveVersionAction({ eventId, versionId: version.id }),
                    )
                  }
                >
                  {t('seating.switchVersion')}
                </Button>
              )}

              {versions.length > 1 ? (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" variant="ghost" disabled={!canEdit}>
                      <Trash2 aria-hidden />
                      <span className="sr-only">{t('seating.deleteVersion')}</span>
                    </Button>
                  }
                  title={t('seating.deleteVersion')}
                  description={t('seating.deleteVersionConfirm')}
                  confirmLabel={t('common.delete')}
                  cancelLabel={t('common.cancel')}
                  onConfirm={async () => {
                    const result = await deleteVersionAction({
                      eventId,
                      versionId: version.id,
                    });
                    if (!result.ok) return result.message;
                    router.refresh();
                    return null;
                  }}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-2">
        <label htmlFor="naziv-verzije" className="text-xs font-medium">
          {t('seating.versionLabel')}
        </label>
        <Input
          id="naziv-verzije"
          className="h-9"
          value={label}
          disabled={!canEdit}
          onChange={(event) => setLabel(event.target.value)}
        />

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || !canEdit}
            onClick={() =>
              void run(async () => {
                const result = await duplicateVersionAction({
                  eventId,
                  versionId: currentVersionId,
                  label,
                });
                if (result.ok) setLabel('');
                return result;
              })
            }
          >
            <Copy aria-hidden />
            {t('seating.duplicateVersion')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={pending || !canEdit || label.trim() === ''}
            onClick={() =>
              void run(async () => {
                const result = await renameVersionAction({
                  eventId,
                  versionId: currentVersionId,
                  label,
                });
                if (result.ok) setLabel('');
                return result;
              })
            }
          >
            {t('seating.renameVersion')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={pending || !canEdit}
            onClick={() =>
              void run(() =>
                setVersionLockAction({
                  eventId,
                  versionId: currentVersionId,
                  isLocked: !isLocked,
                }),
              )
            }
          >
            {isLocked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
            {isLocked ? t('seating.unlockVersion') : t('seating.lockVersion')}
          </Button>
        </div>

        {current ? (
          <p className="text-xs text-muted-foreground">
            {current.label ?? t('seating.versionName', { number: current.version })}
          </p>
        ) : null}
      </div>
    </section>
  );
}
