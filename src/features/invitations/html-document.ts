import type {
  FieldDefinitions,
  FieldValues,
} from '@/features/templates/html-schema';
import { renderInvitationHtml } from '@/features/templates/html-values';
import { templateAssetUrl } from '@/lib/html-template/assets';
import { splitHtmlDocument, type HtmlDocumentParts } from '@/lib/html-template/document';

/**
 * Popunjen dokument uvezenog sajta, rastavljen na delove (zahtev 39.4).
 *
 * Postoji zato što isti dokument treba **dvema** stranama: layout iz njega uzima
 * atribute `<html>` i `<body>` i sadržaj `<head>`-a, a stranica telo. Da svaka
 * radi po svome, lako bi se desilo da jedna popuni tokene, a druga ne - i tada
 * bi u `<head>`-u ostalo doslovno `{{asset:css/stil.css}}`, pa sajt ne bi imao
 * nijedan svoj stil.
 *
 * Popunjavanje se dešava dvaput po zahtevu (layout i stranica), i to je svesno:
 * jedan prolaz regexom preko teksta je jeftin, javna stranica je keširana, a
 * jedan put kroz kod je vredniji od te uštede.
 */
export type RenderedTemplateDocument = HtmlDocumentParts & { full: string };

export function renderTemplateDocument(input: {
  document: string;
  definitions: FieldDefinitions;
  values: FieldValues;
  /** Verzija šablona; od nje zavise adrese fajlova. */
  versionId: string;
  /** Ključ otpremljene fotografije → URL. Demo šablona nema fotografije. */
  mediaUrl?: (assetId: string) => string | null;
}): RenderedTemplateDocument | null {
  const full = renderInvitationHtml({
    document: input.document,
    definitions: input.definitions,
    values: input.values,
    resolution: {
      assetUrl: (path) => templateAssetUrl(input.versionId, path),
      mediaUrl: input.mediaUrl ?? (() => null),
    },
  });

  const parts = splitHtmlDocument(full);
  return parts ? { ...parts, full } : null;
}
