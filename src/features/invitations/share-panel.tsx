'use client';

import { Check, Copy, ExternalLink, Mail, MessageCircle, Send, Share2 } from 'lucide-react';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toaster';
import { useTranslations } from '@/i18n/client';
import { recordShareAction } from '@/server/actions/publishing';

/**
 * Deljenje javnog linka (zahtev 16 i 4.6).
 *
 * Web Share API otvara sistemski meni deljenja i tamo su svi kanali koje gost
 * ima na telefonu - to je i najbolji i najkraći put. Ne postoji svuda (desktop
 * pregledači ga uglavnom nemaju), pa se **ne** prikazuje kada ga nema; umesto
 * njega stoje pojedinačna dugmad.
 *
 * Sva pojedinačna dugmad su obični linkovi sa shemom koju sistem razume, bez
 * ijednog SDK-a i bez ijednog zahteva ka tim servisima - deljenje pozivnice ne
 * treba da javi WhatsAppu da je neko bio na ovoj stranici.
 */
export function SharePanel({
  eventId,
  url,
  qrImageUrl,
}: {
  eventId: string;
  url: string;
  /** Gotov QR kao `data:` slika; crta ga server da ga klijent ne računa. */
  qrImageUrl: string;
}) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);
  const canShare = useNativeShare();

  const message = t('share.message', { url });

  const track = (channel: 'copy' | 'native' | 'whatsapp' | 'viber' | 'email' | 'sms' | 'qr') => {
    void recordShareAction({ eventId, channel });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      track('copy');
      toast.success(t('share.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Bez dozvole za clipboard polje sa linkom je i dalje tu i može se
      // označiti ručno - zato ovde nema poruke o grešci.
    }
  };

  const shareNative = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: t('share.title'), text: message, url });
      track('native');
    } catch {
      // Otkazano deljenje nije greška.
    }
  };

  const channels = [
    {
      key: 'whatsapp' as const,
      label: t('share.whatsapp'),
      href: `https://wa.me/?text=${encodeURIComponent(message)}`,
      icon: MessageCircle,
    },
    {
      key: 'viber' as const,
      label: t('share.viber'),
      href: `viber://forward?text=${encodeURIComponent(message)}`,
      icon: Send,
    },
    {
      key: 'email' as const,
      label: t('share.email'),
      href: `mailto:?subject=${encodeURIComponent(t('share.emailSubject'))}&body=${encodeURIComponent(message)}`,
      icon: Mail,
    },
    {
      key: 'sms' as const,
      label: t('share.sms'),
      // `?&body=` je oblik koji razumeju i iOS i Android.
      href: `sms:?&body=${encodeURIComponent(message)}`,
      icon: MessageCircle,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="javni-link">{t('share.linkLabel')}</Label>
        <div className="flex gap-2">
          <Input
            id="javni-link"
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
            className="font-mono text-xs"
          />
          <Button type="button" variant="secondary" onClick={() => void copy()}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            <span className="hidden sm:inline">{t('share.copy')}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canShare ? (
          <Button type="button" onClick={() => void shareNative()}>
            <Share2 aria-hidden />
            {t('share.native')}
          </Button>
        ) : null}

        {channels.map((channel) => (
          <Button key={channel.key} asChild variant="secondary" onClick={() => track(channel.key)}>
            <a href={channel.href} target="_blank" rel="noopener noreferrer">
              <channel.icon aria-hidden />
              {channel.label}
            </a>
          </Button>
        ))}

        <Button asChild variant="ghost">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {t('share.open')}
          </a>
        </Button>
      </div>

      <section className="space-y-3 border-t border-border pt-5">
        <div>
          <h3 className="text-sm font-semibold">{t('share.qrTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('share.qrHint')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/*
            QR ide kao slika, ne kao ubačen HTML. Projekat nigde ne koristi
            `dangerouslySetInnerHTML`, pa nema razloga da počne ovde - `data:`
            slika daje isti rezultat.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element -- generisan `data:` URL, ne fajl sa hosta */}
          <img
            src={qrImageUrl}
            alt={t('share.qrAlt')}
            width={160}
            height={160}
            className="size-40 shrink-0 rounded-[var(--radius)] border border-border bg-white p-2"
          />

          <div className="flex flex-col gap-2">
            <Button asChild variant="secondary" size="sm" onClick={() => track('qr')}>
              <a href={`/app/dogadjaji/${eventId}/qr?format=svg`} download>
                {t('share.downloadSvg')}
              </a>
            </Button>
            <Button asChild variant="secondary" size="sm" onClick={() => track('qr')}>
              <a href={`/app/dogadjaji/${eventId}/qr?format=png`} download>
                {t('share.downloadPng')}
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Da li pregledač ima sistemsko deljenje.
 *
 * `useSyncExternalStore` umesto efekta koji postavlja stanje: postojanje
 * `navigator.share` je spoljašnja činjenica, na serveru je nema, a ovako nema
 * ni kaskadnog renderovanja ni neslaganja u hidraciji.
 */
function useNativeShare(): boolean {
  const subscribe = useCallback(() => () => undefined, []);
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  );
}
