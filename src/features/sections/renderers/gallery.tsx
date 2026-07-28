'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';

import type { gallerySection } from '../definitions/media';
import type { SectionRendererProps } from '../types';
import { InvitationImage, SectionShell, resolveMedia } from './shared';

type GalleryData = z.infer<typeof gallerySection.schema>;

/**
 * Galerija.
 *
 * Klijentska je samo zbog lightboxa. Bez JavaScripta gost i dalje vidi sve
 * fotografije u rešetki - lightbox je dodatak, ne uslov (zahtev 22, graceful
 * fallback).
 */
export function GalleryRenderer({
  data,
  event,
  index,
}: SectionRendererProps<GalleryData>) {
  const images = data.images
    .map((ref) => resolveMedia(event, ref))
    .filter((media): media is NonNullable<typeof media> => media !== null);

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    // Fokus se vraća na sličicu sa koje je lightbox otvoren (WCAG 2.4.3).
    openerRef.current?.focus();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    const onKeyDown = (eventKey: KeyboardEvent) => {
      if (eventKey.key === 'Escape') close();
      if (eventKey.key === 'ArrowRight') step(1);
      if (eventKey.key === 'ArrowLeft') step(-1);
    };

    window.addEventListener('keydown', onKeyDown);
    // Pozadina ne sme da se skroluje dok je lightbox otvoren.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, step]);

  if (images.length === 0) return null;

  const active = openIndex === null ? null : images[openIndex];

  return (
    <SectionShell
      id={`galerija-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      wide
      center
    >
      <ul
        className={`inv-gallery inv-gallery--${data.layout} inv-gallery--ratio-${data.aspectRatio}`}
        style={{ '--inv-columns': data.columns } as React.CSSProperties}
      >
        {images.map((media, imageIndex) => (
          <li key={`${media.url}-${imageIndex}`} className="inv-gallery__item">
            {data.enableLightbox ? (
              <button
                type="button"
                className="inv-gallery__button"
                onClick={(clickEvent) => {
                  openerRef.current = clickEvent.currentTarget;
                  setOpenIndex(imageIndex);
                }}
              >
                <InvitationImage
                  media={media}
                  sizes={`(max-width: 48rem) 50vw, ${Math.round(100 / data.columns)}vw`}
                />
                <span className="sr-only">Uvećaj fotografiju {imageIndex + 1}</span>
              </button>
            ) : (
              <InvitationImage
                media={media}
                sizes={`(max-width: 48rem) 50vw, ${Math.round(100 / data.columns)}vw`}
              />
            )}
          </li>
        ))}
      </ul>

      {active ? (
        <div
          className="inv-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={active.alt || `Fotografija ${(openIndex ?? 0) + 1}`}
          ref={dialogRef}
          tabIndex={-1}
          onClick={(clickEvent) => {
            if (clickEvent.target === clickEvent.currentTarget) close();
          }}
        >
          <button
            type="button"
            className="inv-lightbox__close"
            onClick={close}
            aria-label="Zatvori"
          >
            <X aria-hidden />
          </button>

          {images.length > 1 ? (
            <button
              type="button"
              className="inv-lightbox__nav inv-lightbox__nav--prev"
              onClick={() => step(-1)}
              aria-label="Prethodna fotografija"
            >
              <ChevronLeft aria-hidden />
            </button>
          ) : null}

          <figure className="inv-lightbox__figure">
            <img src={active.url} alt={active.alt} className="inv-lightbox__image" />
            {active.alt ? (
              <figcaption className="inv-lightbox__caption">{active.alt}</figcaption>
            ) : null}
          </figure>

          {images.length > 1 ? (
            <button
              type="button"
              className="inv-lightbox__nav inv-lightbox__nav--next"
              onClick={() => step(1)}
              aria-label="Sledeća fotografija"
            >
              <ChevronRight aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </SectionShell>
  );
}
