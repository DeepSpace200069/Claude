import type { z } from 'zod';

import type { namesSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';

type NamesData = z.infer<typeof namesSection.schema>;

/** Imena slavljenika; radi i sa jednim i sa dva imena. */
export function NamesRenderer({ data, index }: SectionRendererProps<NamesData>) {
  const hasBoth = Boolean(data.primaryName && data.secondaryName);
  const hasAny = Boolean(data.primaryName || data.secondaryName);

  if (!hasAny) return null;

  return (
    <section
      className="inv-section inv-reveal"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
      aria-label={
        hasBoth
          ? `${data.primaryName} ${data.connector} ${data.secondaryName}`
          : data.primaryName || data.secondaryName
      }
    >
      <div
        className={
          data.alignment === 'center'
            ? 'inv-container inv-stack inv-center'
            : 'inv-container inv-stack'
        }
      >
        <p className="inv-names">
          <span className="inv-names__part">{data.primaryName}</span>
          {hasBoth ? (
            <>
              <span className="inv-names__connector">{data.connector}</span>
              <span className="inv-names__part">{data.secondaryName}</span>
            </>
          ) : null}
        </p>
        {data.note ? <p className="inv-muted">{data.note}</p> : null}
      </div>
    </section>
  );
}
