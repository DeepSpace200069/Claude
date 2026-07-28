import type { z } from 'zod';

import type { scheduleSection } from '../definitions/logistics';
import type { SectionRendererProps } from '../types';
import { InvitationImage, SectionIcon, SectionShell, resolveMedia } from './shared';

type ScheduleData = z.infer<typeof scheduleSection.schema>;

/**
 * Satnica.
 *
 * Renderuje se kao uređena lista: redosled stavki nosi značenje, pa `<ol>`
 * čitaču ekrana saopštava i da ih ima sedam i koja je koja po redu.
 */
export function ScheduleRenderer({
  data,
  event,
  index,
}: SectionRendererProps<ScheduleData>) {
  if (data.items.length === 0) return null;

  return (
    <SectionShell
      id={`satnica-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      center={data.style !== 'list'}
    >
      <ol className={`inv-schedule inv-schedule--${data.style}`}>
        {data.items.map((item) => {
          const image = resolveMedia(event, item.image);

          return (
            <li key={item.id} className="inv-schedule__item">
              <div className="inv-schedule__marker" aria-hidden>
                <SectionIcon name={item.icon} className="inv-icon" />
              </div>

              <div className="inv-schedule__body">
                {item.time ? (
                  <p className="inv-schedule__time">
                    <time>{item.time}</time>
                  </p>
                ) : null}

                <h3 className="inv-schedule__title">{item.title}</h3>

                {item.locationLabel ? (
                  <p className="inv-muted inv-schedule__place">{item.locationLabel}</p>
                ) : null}

                {item.description ? <p>{item.description}</p> : null}

                {image ? (
                  <div className="inv-schedule__media">
                    <InvitationImage media={image} sizes="(max-width: 48rem) 100vw, 22rem" />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}
