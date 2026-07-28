import type { z } from 'zod';

import type { peopleSection } from '../definitions/logistics';
import type { SectionRendererProps } from '../types';
import { InvitationImage, SectionShell, resolveMedia } from './shared';

type PeopleData = z.infer<typeof peopleSection.schema>;

/** Kumovi, roditelji, braća i sestre - ljudi koje pozivnica posebno izdvaja. */
export function PeopleRenderer({
  data,
  event,
  index,
}: SectionRendererProps<PeopleData>) {
  if (data.people.length === 0) return null;

  return (
    <SectionShell
      id={`osobe-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      wide={data.layout === 'grid' && data.people.length > 2}
      center
    >
      <ul className={`inv-people inv-people--${data.layout}`}>
        {data.people.map((person) => {
          const photo = data.showPhotos ? resolveMedia(event, person.photo) : null;

          return (
            <li key={person.id} className="inv-person">
              {photo ? (
                <div className="inv-person__photo">
                  <InvitationImage media={photo} sizes="12rem" />
                </div>
              ) : null}
              <div className="inv-person__body">
                {person.role ? (
                  <p className="inv-eyebrow">{person.role}</p>
                ) : null}
                <h3 className="inv-person__name">{person.name}</h3>
                {person.note ? <p className="inv-muted">{person.note}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
