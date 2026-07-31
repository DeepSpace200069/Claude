'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';

import type { ConsentChoice } from './consent';
import { decideConsent, useConsent, useConsentReady } from './consent-store';

/**
 * Promena odluke o merenju (zahtev 29).
 *
 * Odluka se menja jednako lako u oba smera - opoziv pristanka mora da bude isto
 * dostupan kao i davanje. Do prve provere se ne prikazuje ni jedno ni drugo
 * stanje, jer se odluka čita tek u pregledaču.
 */
export function ConsentSettings() {
  const t = useTranslations();
  const choice: ConsentChoice | null = useConsent()?.choice ?? null;
  const ready = useConsentReady();

  const decide = (next: ConsentChoice) => {
    decideConsent(next);
    toast.success(t('cookies.saved'));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {t('cookies.currentLabel')}{' '}
        {ready ? (
          <Badge variant={choice === 'sve' ? 'success' : 'neutral'}>
            {choice === 'sve'
              ? t('cookies.stateAll')
              : choice === 'neophodno'
                ? t('cookies.stateNecessary')
                : t('cookies.stateUndecided')}
          </Badge>
        ) : null}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!ready || choice === 'neophodno'}
          onClick={() => decide('neophodno')}
        >
          {t('cookies.chooseNecessary')}
        </Button>
        <Button
          type="button"
          disabled={!ready || choice === 'sve'}
          onClick={() => decide('sve')}
        >
          {t('cookies.chooseAll')}
        </Button>
      </div>
    </div>
  );
}
