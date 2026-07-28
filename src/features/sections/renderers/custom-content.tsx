import type { z } from 'zod';

import type { customContentSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import { InvitationImage, SectionShell, resolveMedia } from './shared';

type CustomContentData = z.infer<typeof customContentSection.schema>;

/**
 * Prilagođeni sadržaj.
 *
 * Ovo je zamena za „ubaci svoj HTML”. Renderuje se **struktura**, ne markup:
 * svaki blok je poznat tip koji sami iscrtavamo, pa nema tačke u kojoj bi
 * korisnički unos postao izvršni kod (zahtev 9 i 24). Zbog toga ovde nema
 * `dangerouslySetInnerHTML` niti bilo kakve sanitizacije - nema šta da se
 * sanitizuje.
 */
export function CustomContentRenderer({
  data,
  event,
  index,
}: SectionRendererProps<CustomContentData>) {
  const image = resolveMedia(event, data.image);
  const hasContent = data.content.blocks.length > 0;

  if (!data.title && !hasContent && !image && !data.button) return null;

  return (
    <SectionShell id={`sadrzaj-${index}`} title={data.title} index={index}>
      {image ? (
        <div className="inv-custom__media">
          <InvitationImage media={image} sizes="(max-width: 48rem) 100vw, 42rem" />
        </div>
      ) : null}

      {hasContent ? (
        <div className="inv-rich">
          {data.content.blocks.map((block, blockIndex) => {
            const key = `${block.kind}-${blockIndex}`;

            switch (block.kind) {
              case 'heading':
                return block.level === 2 ? (
                  <h3 key={key}>{block.text}</h3>
                ) : (
                  <h4 key={key}>{block.text}</h4>
                );

              case 'paragraph':
                return <p key={key}>{block.text}</p>;

              case 'quote':
                return (
                  <blockquote key={key} className="inv-rich__quote">
                    {block.text}
                  </blockquote>
                );

              case 'list':
                return block.ordered ? (
                  <ol key={key} className="inv-rich__list">
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  <ul key={key} className="inv-rich__list">
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex}>{item}</li>
                    ))}
                  </ul>
                );

              default:
                return null;
            }
          })}
        </div>
      ) : null}

      {data.button ? (
        <div className="inv-actions">
          <a
            href={data.button.url}
            className={
              data.button.style === 'link'
                ? 'inv-link'
                : data.button.style === 'secondary'
                  ? 'inv-button inv-button--secondary'
                  : 'inv-button'
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {data.button.label}
          </a>
        </div>
      ) : null}
    </SectionShell>
  );
}
