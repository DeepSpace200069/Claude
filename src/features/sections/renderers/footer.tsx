import type { z } from 'zod';

import { brand } from '@/config/brand';

import type { footerSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import { Divider } from './shared';

type FooterData = z.infer<typeof footerSection.schema>;

/**
 * Podnožje pozivnice.
 *
 * Platformski brending se prikazuje kada ga organizator nije isključio; samo
 * isključivanje je vezano za paket (`removeBranding`), a proverava se pri
 * čuvanju sekcije, ne ovde - renderer samo poštuje sačuvanu vrednost.
 */
export function FooterRenderer({ data, index }: SectionRendererProps<FooterData>) {
  return (
    <footer
      className="inv-section inv-footer inv-reveal"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      <div className="inv-container inv-stack inv-center">
        <Divider />

        {data.text ? <p className="inv-muted">{data.text}</p> : null}

        {data.button ? (
          <a
            href={data.button.url}
            className={
              data.button.style === 'link' ? 'inv-link' : 'inv-button inv-button--secondary'
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {data.button.label}
          </a>
        ) : null}

        {data.showBranding ? (
          <p className="inv-footer__branding inv-muted">
            Napravljeno uz{' '}
            <a href={`https://${brand.domain}`} className="inv-link" rel="noopener">
              {brand.name}
            </a>
          </p>
        ) : null}
      </div>
    </footer>
  );
}
