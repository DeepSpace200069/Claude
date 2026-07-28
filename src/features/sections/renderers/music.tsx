'use client';

import { Music, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';

import type { musicSection } from '../definitions/media';
import type { SectionRendererProps } from '../types';
import { SectionShell } from './shared';

type MusicData = z.infer<typeof musicSection.schema>;

/**
 * Muzika.
 *
 * Zvuk **nikad** ne kreće sam od sebe. Pregledači blokiraju autoplay sa zvukom
 * pre interakcije, a i kad bi dozvolili, neočekivana muzika je loše korisničko
 * iskustvo i problem pristupačnosti (zahtev 9 i 22). `autoplayAfterInteraction`
 * zato znači samo: „ako je gost već negde kliknuo, smemo da pustimo” - i uvek
 * uz vidljivu kontrolu za pauzu.
 */
export function MusicRenderer({ data, event, index }: SectionRendererProps<MusicData>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const source =
    data.source === 'upload' && data.assetId
      ? event.media[data.assetId]?.url
      : data.source === 'link'
        ? (data.externalUrl ?? undefined)
        : undefined;

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = data.volume / 100;
  }, [data.volume]);

  useEffect(() => {
    if (!data.autoplayAfterInteraction || !source) return;

    const tryPlay = () => {
      void audioRef.current?.play().then(
        () => setIsPlaying(true),
        // Odbijanje je očekivano stanje, ne greška - gost jednostavno klikne sam.
        () => setIsPlaying(false),
      );
    };

    window.addEventListener('pointerdown', tryPlay, { once: true });
    window.addEventListener('keydown', tryPlay, { once: true });

    return () => {
      window.removeEventListener('pointerdown', tryPlay);
      window.removeEventListener('keydown', tryPlay);
    };
  }, [data.autoplayAfterInteraction, source]);

  if (!source || failed) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      void audio.play().then(
        () => setIsPlaying(true),
        () => setFailed(true),
      );
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <SectionShell id={`muzika-${index}`} title={data.title} index={index} center>
      <div className="inv-music">
        <audio
          ref={audioRef}
          src={source}
          loop={data.loop}
          preload="none"
          onEnded={() => setIsPlaying(false)}
          onError={() => setFailed(true)}
        />

        {data.showControls ? (
          <button type="button" className="inv-button inv-music__toggle" onClick={toggle}>
            {isPlaying ? <Pause className="inv-icon" aria-hidden /> : <Play className="inv-icon" aria-hidden />}
            {isPlaying ? 'Pauziraj muziku' : 'Pusti muziku'}
          </button>
        ) : (
          <p className="inv-muted">
            <Music className="inv-icon" aria-hidden /> Muzika je pripremljena uz
            ovu pozivnicu.
          </p>
        )}
      </div>
    </SectionShell>
  );
}
