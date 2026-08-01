import 'server-only';

import { eq } from 'drizzle-orm';

import type { FieldDefinitions } from '@/features/templates/html-schema';
import { db } from '@/server/db';
import { templateVersions, templates } from '@/server/db/schema';

/**
 * Pregled **nacrta** uvezenog šablona (zahtev 7.6 i 39.3).
 *
 * Uvoznik pravi radnu verziju; administrator treba da vidi šta je od tuđeg
 * sajta zaista nastalo pre nego što ga objavi. Kod šablona od sekcija to se
 * pročita iz spiska sekcija, ali uvezen sajt je vizuelna stvar - jedini pošten
 * način da se proveri jeste da se pogleda.
 *
 * Bez ovoga bi jedini put do pregleda bio da se šablon prvo objavi, pa pogleda -
 * dakle da se u galeriju pusti nešto što niko nije video.
 *
 * Nacrt nije javni sadržaj i ne sme da se otvori pogađanjem id-a verzije. Dozvolu
 * proverava **ruta** (`requireAdminPage` u layout-u i u stranici), kao i na svakoj
 * drugoj administratorskoj stranici - servisi u ovom projektu čitaju, a ne
 * odlučuju ko sme.
 */
export type TemplateVersionPreview = {
  templateName: string;
  templateSlug: string;
  versionId: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  document: string;
  definitions: FieldDefinitions;
};

export async function loadTemplateVersionPreview(
  versionId: string,
): Promise<TemplateVersionPreview | null> {
  const [row] = await db
    .select({
      templateName: templates.name,
      templateSlug: templates.slug,
      versionId: templateVersions.id,
      version: templateVersions.version,
      status: templateVersions.status,
      document: templateVersions.htmlDocument,
      definitions: templateVersions.fieldDefinitions,
    })
    .from(templateVersions)
    .innerJoin(templates, eq(templateVersions.templateId, templates.id))
    .where(eq(templateVersions.id, versionId))
    .limit(1);

  if (!row || !row.document || !row.definitions) return null;

  return {
    ...row,
    document: row.document,
    definitions: row.definitions,
  };
}
