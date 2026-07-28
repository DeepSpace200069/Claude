import type { z } from 'zod';

import type { heroSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import {
  Divider,
  InvitationImage,
  formatEventDate,
  resolveMedia,
} from './shared';

type HeroData = z.infer<typeof heroSection.schema>;

/**
 * Naslovna sekcija.
 *
 * Server komponenta - uvodna animacija je čist CSS, pa gost ne čeka JavaScript
 * da bi video prvi ekran pozivnice (zahtev 22 i 32).
 */
export function HeroRenderer({
  data,
  locale,
  event,
}: SectionRendererProps<HeroData>) {
  const image = resolveMedia(event, data.image);
  const dateLabel = formatEventDate(event, locale);
  const isFullBleed = data.layout === 'full-bleed' && image !== null;
  const isSplit = data.layout === 'split' && image !== null;

  const heading = (
    <>
      {data.eyebrow ? <p className="inv-eyebrow">{data.eyebrow}</p> : null}
      {data.title ? <h1>{data.title}</h1> : null}
      {data.subtitle ? <p className="inv-hero__subtitle">{data.subtitle}</p> : null}
      {!data.subtitle && dateLabel ? (
        <p className="inv-hero__subtitle">{dateLabel}</p>
      ) : null}
      <Divider />
    </>
  );

  if (isFullBleed) {
    return (
      <section className="inv-hero inv-hero--full" aria-label={data.title || undefined}>
        <InvitationImage
          media={image}
          className="inv-hero__bg"
          priority
          sizes="100vw"
        />
        {/*
          Zatamnjenje je odvojen sloj sa `aria-hidden`: tekst iznad fotografije
          mora da ostane čitljiv, a čitač ekrana ne treba da zna za overlay.
        */}
        <div
          className="inv-hero__overlay"
          style={{ opacity: data.overlayOpacity / 100 }}
          aria-hidden
        />
        <div className="inv-hero__content inv-reveal">{heading}</div>
      </section>
    );
  }

  if (isSplit) {
    return (
      <section className="inv-hero inv-hero--split" aria-label={data.title || undefined}>
        <div className="inv-hero__media">
          <InvitationImage media={image} priority sizes="(max-width: 48rem) 100vw, 50vw" />
        </div>
        <div className="inv-hero__content inv-reveal">{heading}</div>
      </section>
    );
  }

  return (
    <section
      className={`inv-hero inv-hero--${data.layout}`}
      aria-label={data.title || undefined}
    >
      <div className="inv-container inv-hero__content inv-reveal">
        {image ? (
          <div className="inv-hero__frame">
            <InvitationImage media={image} priority sizes="(max-width: 48rem) 100vw, 42rem" />
          </div>
        ) : null}
        {heading}
      </div>
    </section>
  );
}
