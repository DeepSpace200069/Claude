'use client';

import { Globe, PowerOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import {
  publishInvitationAction,
  unpublishInvitationAction,
} from '@/server/actions/publishing';

/**
 * Objavljivanje i isključivanje javnog linka (zahtev 4.3 i 17).
 *
 * Kada paket ne uključuje objavljivanje, dugme **postoji ali je onemogućeno**, a
 * uz njega stoji tačan razlog i put dalje. To je namerno: sakriveno dugme
 * ostavlja korisnika da se pita zašto nešto ne može, a lažno uspešno
 * objavljivanje bi bilo još gore. Server istu proveru ponavlja, pa ni zahtev
 * mimo interfejsa ne prolazi.
 */
export function PublishControls({
  eventId,
  status,
  canPublish,
  planName,
}: {
  eventId: string;
  status: 'draft' | 'published' | 'unpublished';
  canPublish: boolean;
  planName: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: 'publish' | 'unpublish') => {
    setBusy(true);
    setError(null);

    const result =
      action === 'publish'
        ? await publishInvitationAction({ eventId })
        : await unpublishInvitationAction({ eventId });

    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    toast.success(
      action === 'publish' ? t('publishing.published') : t('publishing.unpublished'),
    );
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!canPublish ? (
        <Alert tone="info" title={t('publishing.planLockedTitle')}>
          <p>{t('publishing.planLockedText', { plan: planName })}</p>
          <p className="mt-2">
            {/*
              Vodi na naplatu **ovog** događaja, ne na opšti cenovnik: paket se
              kupuje po pozivnici, pa je izbor paketa uvek u kontekstu događaja.
            */}
            <Link
              href={`/app/dogadjaji/${eventId}/naplata`}
              className="font-medium underline underline-offset-4"
            >
              {t('publishing.seePlans')}
            </Link>
          </p>
        </Alert>
      ) : null}

      {status === 'published' ? (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={() => void run('unpublish')}
          >
            <PowerOff aria-hidden />
            {t('publishing.unpublish')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('publishing.unpublishHint')}
          </p>
        </div>
      ) : (
        <Button
          type="button"
          loading={busy}
          disabled={!canPublish}
          onClick={() => void run('publish')}
        >
          <Globe aria-hidden />
          {busy ? t('publishing.publishing') : t('publishing.publish')}
        </Button>
      )}
    </div>
  );
}
