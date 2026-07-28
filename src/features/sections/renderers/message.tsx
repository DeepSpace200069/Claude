import type { z } from 'zod';

import type { messageSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import { Divider } from './shared';

type MessageData = z.infer<typeof messageSection.schema>;

/** Uvodna ili završna poruka; isti tip sekcije, razlika je samo u položaju. */
export function MessageRenderer({ data, index }: SectionRendererProps<MessageData>) {
  if (!data.title && !data.body) return null;

  const headingId = `poruka-${index}`;
  const centered = data.alignment === 'center';

  const body = data.body ? (
    <p className="inv-message__body">{data.body}</p>
  ) : null;

  return (
    <section
      className="inv-section inv-reveal"
      aria-labelledby={data.title ? headingId : undefined}
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div
        className={
          centered ? 'inv-container inv-stack inv-center' : 'inv-container inv-stack'
        }
      >
        {data.title ? <h2 id={headingId}>{data.title}</h2> : null}

        {data.decoration === 'quote' && body ? (
          <blockquote className="inv-message inv-message--quote">{body}</blockquote>
        ) : (
          body
        )}

        {data.signature ? (
          <p className="inv-message__signature">{data.signature}</p>
        ) : null}

        {data.decoration === 'ornament' ? <Divider /> : null}
      </div>
    </section>
  );
}
