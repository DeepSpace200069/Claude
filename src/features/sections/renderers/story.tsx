import type { z } from 'zod';

import { formatDate } from '@/i18n/format';

import type { storySection } from '../definitions/media';
import type { SectionRendererProps } from '../types';
import { InvitationImage, SectionShell, resolveMedia } from './shared';

type StoryData = z.infer<typeof storySection.schema>;

/**
 * Priča.
 *
 * Ista sekcija služi i za „kako smo se upoznali” na venčanju i za „prva godina”
 * na prvom rođendanu - struktura je identična, razlikuje se samo sadržaj koji
 * šablon ponudi.
 */
export function StoryRenderer({
  data,
  locale,
  event,
  index,
}: SectionRendererProps<StoryData>) {
  if (data.entries.length === 0) return null;

  return (
    <SectionShell
      id={`prica-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      wide={data.style !== 'timeline'}
      center
    >
      <ol className={`inv-story inv-story--${data.style}`}>
        {data.entries.map((entry, entryIndex) => {
          const image = resolveMedia(event, entry.image);
          const dateLabel = entry.date
            ? formatDate(new Date(`${entry.date}T12:00:00Z`), locale, {
                timeZone: event.timeZone,
                dateStyle: 'long',
              })
            : null;

          return (
            <li
              key={entry.id}
              className="inv-story__entry"
              // Naizmenična strana kod `alternating` rasporeda.
              data-side={entryIndex % 2 === 0 ? 'start' : 'end'}
            >
              {image ? (
                <div className="inv-story__media">
                  <InvitationImage
                    media={image}
                    sizes="(max-width: 48rem) 100vw, 26rem"
                  />
                </div>
              ) : null}

              <div className="inv-story__body">
                {entry.label || dateLabel ? (
                  <p className="inv-eyebrow">{entry.label || dateLabel}</p>
                ) : null}
                <h3>{entry.title}</h3>
                {entry.text ? <p className="inv-muted">{entry.text}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}
