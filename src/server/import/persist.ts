import { randomUUID } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';

import type { TemplateAsset } from '@/features/templates/html-schema';
import { defaultThemeTokens } from '@/features/themes/tokens';
import {
  templateAssetStorageKey,
  templateAssetUrl,
} from '@/lib/html-template/assets';
// Namerno `factory`, a ne `index`: uvoz se pokreće iz terminala, gde bi
// `server-only` oznaka iz `index.ts` oborila učitavanje modula.
import { getStorageAdapter } from '@/server/adapters/storage/factory';
import { db } from '@/server/db';
import { eventTypes, templateVersions, templates } from '@/server/db/schema';

import type { BuiltTemplate } from './build';
import { ImportError } from './errors';
import type { ImportManifest } from './manifest';

/**
 * Upis uvezenog šablona (zahtev 39.3).
 *
 * Uvoz je idempotentan **po slug-u**: ponovno pokretanje ne pravi drugi šablon
 * nego novu radnu verziju istog. Objavljene verzije se pri tome ne diraju - one
 * su temelj već napravljenih pozivnica (zahtev 39.2), pa uvoz nema pravo da ih
 * menja. Ako radna verzija već postoji, ona se zamenjuje: dve nedovršene
 * verzije istog šablona nikome ne koriste.
 *
 * Fajlovi idu u storage **pre** upisa u bazu. Ako upis padne, obriše se ono što
 * je otpremljeno - baza je merodavna, pa u njoj ne sme da ostane verzija bez
 * fajlova, ni fajl bez verzije.
 */

export type SaveResult = {
  templateId: string;
  versionId: string;
  version: number;
  /** Da li je šablon napravljen sada ili je zatečen po slug-u. */
  created: boolean;
  /** Broj obrisanih fajlova prethodne radne verzije. */
  replacedAssets: number;
};

/** Id verzije se pravi unapred: adrese fajlova zavise od njega, a fajlovi se pišu prvi. */
export function newVersionId(): string {
  return randomUUID();
}

export function assetUrlFor(versionId: string): (path: string) => string {
  return (path) => templateAssetUrl(versionId, path);
}

export async function saveTemplate(options: {
  manifest: ImportManifest;
  built: BuiltTemplate;
  versionId: string;
}): Promise<SaveResult> {
  const { manifest, built, versionId } = options;
  const storage = getStorageAdapter();

  const eventType = await db.query.eventTypes.findFirst({
    where: eq(eventTypes.slug, manifest.eventType),
  });
  if (!eventType) {
    throw new ImportError(
      `Tip događaja „${manifest.eventType}” ne postoji. Pokreni \`pnpm db:seed\` ili ` +
        'ispravi „eventType” u template.json.',
    );
  }

  const existing = await db.query.templates.findFirst({
    where: eq(templates.slug, manifest.slug),
  });

  if (existing && existing.kind !== 'html') {
    throw new ImportError(
      `Šablon „${manifest.slug}” već postoji i nije HTML šablon. Uvoz bi prepisao ` +
        'šablon od sekcija, pa je prekinut.',
    );
  }

  const previousDraft = existing
    ? await db.query.templateVersions.findFirst({
        where: and(
          eq(templateVersions.templateId, existing.id),
          eq(templateVersions.status, 'draft'),
        ),
        orderBy: desc(templateVersions.version),
      })
    : undefined;

  const version = previousDraft ? previousDraft.version : await nextVersion(existing?.id);

  // 1. Fajlovi.
  const assets: TemplateAsset[] = [];
  for (const asset of built.assets) {
    const storageKey = templateAssetStorageKey(versionId, asset.path);
    await storage.putObject(storageKey, asset.content, asset.contentType);
    assets.push({
      path: asset.path,
      storageKey,
      contentType: asset.contentType,
      bytes: asset.content.byteLength,
    });
  }

  // 2. Baza.
  try {
    const templateId = await db.transaction(async (tx) => {
      const metadata = {
        name: manifest.name,
        description: manifest.description,
        eventTypeId: eventType.id,
        kind: 'html' as const,
        style: manifest.style,
        dominantColor: manifest.dominantColor,
        usesPhotos: manifest.usesPhotos,
        requiredPlanCode: manifest.requiredPlan,
        isFeatured: manifest.isFeatured,
        sortOrder: manifest.sortOrder,
      };

      const id =
        existing?.id ??
        (
          await tx
            .insert(templates)
            .values({ slug: manifest.slug, status: 'draft', ...metadata })
            .returning({ id: templates.id })
        )[0]?.id;

      if (!id) throw new ImportError('Upis šablona nije vratio id.');

      if (existing) {
        await tx.update(templates).set(metadata).where(eq(templates.id, id));
      }

      if (previousDraft) {
        await tx.delete(templateVersions).where(eq(templateVersions.id, previousDraft.id));
      }

      await tx.insert(templateVersions).values({
        id: versionId,
        templateId: id,
        version,
        status: 'draft',
        themeTokens: defaultThemeTokens,
        sections: [],
        htmlDocument: built.document,
        fieldDefinitions: built.fieldDefinitions,
        assets,
      });

      return id;
    });

    // 3. Fajlovi zamenjene radne verzije više nikome ne trebaju.
    const replaced = previousDraft?.assets ?? [];
    for (const asset of replaced) {
      await storage.delete(asset.storageKey).catch(() => undefined);
    }

    return {
      templateId,
      versionId,
      version,
      created: !existing,
      replacedAssets: replaced.length,
    };
  } catch (error) {
    for (const asset of assets) {
      await storage.delete(asset.storageKey).catch(() => undefined);
    }
    throw error;
  }
}

async function nextVersion(templateId: string | undefined): Promise<number> {
  if (!templateId) return 1;

  const latest = await db.query.templateVersions.findFirst({
    where: eq(templateVersions.templateId, templateId),
    orderBy: desc(templateVersions.version),
  });

  return (latest?.version ?? 0) + 1;
}
