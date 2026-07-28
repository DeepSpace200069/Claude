import { Mail, Phone } from 'lucide-react';
import type { z } from 'zod';

import type { contactSection } from '../definitions/basics';
import type { SectionRendererProps } from '../types';
import { SectionShell } from './shared';

type ContactData = z.infer<typeof contactSection.schema>;

/**
 * Kontakt domaćina.
 *
 * Telefon i email se prikazuju **samo** kada ih je organizator izričito uneo -
 * podrazumevano se ne izlažu (zahtev 23).
 */
export function ContactRenderer({ data, index }: SectionRendererProps<ContactData>) {
  const contacts = data.contacts.filter((contact) => contact.name.trim().length > 0);
  if (contacts.length === 0) return null;

  return (
    <SectionShell
      id={`kontakt-${index}`}
      title={data.title}
      intro={data.note}
      index={index}
      center
    >
      <ul className="inv-contacts">
        {contacts.map((contact, contactIndex) => (
          <li key={`${contact.name}-${contactIndex}`} className="inv-contact">
            <p className="inv-contact__name">{contact.name}</p>
            {contact.role ? (
              <p className="inv-eyebrow">{contact.role}</p>
            ) : null}

            <div className="inv-contact__links">
              {contact.phone ? (
                <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="inv-link">
                  <Phone className="inv-icon inv-icon--sm" aria-hidden />
                  {contact.phone}
                  <span className="sr-only">— {contact.name}</span>
                </a>
              ) : null}
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="inv-link">
                  <Mail className="inv-icon inv-icon--sm" aria-hidden />
                  {contact.email}
                  <span className="sr-only">— {contact.name}</span>
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
