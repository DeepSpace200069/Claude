import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

import { appUrl } from '@/config/brand';
import { renderTemplateDocument } from '@/features/invitations/html-document';
import { getTemplateBySlug } from '@/server/services/templates';

/**
 * Korenski layout demo prikaza uvezenog sajta (zahtev 6 i 39.4).
 *
 * Isti razlog kao kod javne pozivnice: sajt donosi svoj `<html>` i svoj reset,
 * pa mu treba sopstveni dokument. Zato ova ruta i stoji u grupi `(pozivnica)`, a
 * ne uz galeriju - galerija ovaj prikaz ubacuje kao `<iframe>`, tako da traka sa
 * dugmadima ostaje u našem izgledu, a sajt u svom.
 */
export function generateMetadata(): Metadata {
  // Demo nije kanonska stranica šablona; indeksira se detaljna stranica.
  return {
    metadataBase: new URL(appUrl()),
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function HtmlDemoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ templateSlug: string }>;
}) {
  const { templateSlug } = await params;
  const template = await getTemplateBySlug(templateSlug);

  if (
    !template ||
    template.kind !== 'html' ||
    !template.htmlDocument ||
    !template.fieldDefinitions
  ) {
    notFound();
  }

  const parts = renderTemplateDocument({
    document: template.htmlDocument,
    definitions: template.fieldDefinitions,
    // Demo koristi vrednosti iz samog šablona; dopunjava ih `resolveFieldValues`.
    values: {},
    versionId: template.versionId,
  });
  if (!parts) notFound();

  return (
    <html {...parts.htmlAttributes}>
      <body {...parts.bodyAttributes}>
        <div hidden dangerouslySetInnerHTML={{ __html: parts.headHtml }} />
        {children}
      </body>
    </html>
  );
}
