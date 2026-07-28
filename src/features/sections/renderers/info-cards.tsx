import { ExternalLink } from 'lucide-react';
import type { z } from 'zod';

import type { infoCardsSection } from '../definitions/logistics';
import type { SectionRendererProps } from '../types';
import { SectionIcon, SectionShell } from './shared';

type InfoCardsData = z.infer<typeof infoCardsSection.schema>;

/** Kartice sa korisnim informacijama: parking, smeštaj, dress code, pokloni… */
export function InfoCardsRenderer({
  data,
  index,
}: SectionRendererProps<InfoCardsData>) {
  if (data.cards.length === 0) return null;

  return (
    <SectionShell
      id={`informacije-${index}`}
      title={data.title}
      intro={data.intro}
      index={index}
      wide={data.columns > 1}
      center
    >
      <ul
        className="inv-info-cards"
        style={{ '--inv-columns': data.columns } as React.CSSProperties}
      >
        {data.cards.map((card) => (
          <li key={card.id} className="inv-card inv-info-card">
            <span className="inv-info-card__icon" aria-hidden>
              <SectionIcon name={card.icon} className="inv-icon" />
            </span>
            <h3>{card.title}</h3>
            {card.body ? <p className="inv-muted">{card.body}</p> : null}
            {card.linkUrl ? (
              <a
                href={card.linkUrl}
                className="inv-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {card.linkLabel || 'Više informacija'}
                <ExternalLink className="inv-icon inv-icon--sm" aria-hidden />
                {/* Kontekst za čitač ekrana kada je više linkova istog teksta. */}
                <span className="sr-only">({card.title})</span>
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
