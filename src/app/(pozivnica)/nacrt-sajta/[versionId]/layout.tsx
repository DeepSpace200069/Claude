import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

import { renderTemplateDocument } from '@/features/invitations/html-document';
import { requireAdminPage } from '@/server/authz/page-guards';
import { loadTemplateVersionPreview } from '@/server/services/template-preview';

/**
 * Korenski layout pregleda nacrta uvezenog šablona (zahtev 7.6).
 *
 * Isto kao kod javne pozivnice: sajt donosi svoj `<html>` i svoj reset, pa mu
 * treba sopstveni dokument. Zato ova ruta stoji u grupi `(pozivnica)`, a admin
 * panel je otvara u novom tabu.
 */
export function generateMetadata(): Metadata {
  // Nacrt nije javni sadržaj; ni pretraživač ne treba da zna da postoji.
  return { robots: { index: false, follow: false } };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function DraftPreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ versionId: string }>;
}) {
  const { versionId } = await params;

  // Nacrt nije javni sadržaj; proveravaju ga i layout i stranica, jer se svaka
  // od njih može otvoriti i sama.
  await requireAdminPage(`/nacrt-sajta/${versionId}`);

  const preview = await loadTemplateVersionPreview(versionId);
  if (!preview) notFound();

  const parts = renderTemplateDocument({
    document: preview.document,
    definitions: preview.definitions,
    // Pregled prikazuje šablon onakav kakav je uvezen: vrednosti iz samog sajta.
    values: {},
    versionId: preview.versionId,
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
