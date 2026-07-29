'use server';

import {
  confirmUploadSchema,
  deleteMediaSchema,
  requestUploadSchema,
  updateMediaAltSchema,
} from '@/features/editor/schemas';
import { requireEventAccess } from '@/server/authz';
import { RATE_LIMITS, rateLimit } from '@/server/rate-limit';
import {
  confirmUpload,
  deleteMedia,
  requestUpload,
  updateMediaAlt,
  type MediaAsset,
} from '@/server/services/media';

import { failure, success, toActionFailure, zodFieldErrors, type ActionResult } from './result';

/**
 * Server akcije za fotografije (zahtev 24).
 *
 * Vlasništvo nad događajem se proverava pre izdavanja karte za otpremanje, pa
 * potpisan URL ne može da se izmami za tuđi događaj. Sam URL važi kratko i vezan
 * je za tačan ključ u skladištu.
 */

export type UploadTicketResponse = {
  assetId: string;
  storageKey: string;
  uploadUrl: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  expiresAt: string;
};

export async function requestUploadAction(
  input: unknown,
): Promise<ActionResult<UploadTicketResponse>> {
  try {
    const parsed = requestUploadSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Fotografija nije u dozvoljenom formatu.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    const access = await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const limit = rateLimit(
      `upload-ticket:${access.user.id}`,
      RATE_LIMITS.uploadTicket,
    );
    if (!limit.allowed) {
      return failure(
        'rate_limited',
        'Previše otpremanja u kratkom roku. Sačekajte trenutak.',
      );
    }

    const { assetId, ticket } = await requestUpload({
      userId: access.user.id,
      eventId: parsed.data.eventId,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    });

    return success({
      assetId,
      storageKey: ticket.storageKey,
      uploadUrl: ticket.uploadUrl,
      method: ticket.method,
      headers: ticket.headers,
      expiresAt: ticket.expiresAt.toISOString(),
    });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function confirmUploadAction(
  input: unknown,
): Promise<ActionResult<MediaAsset>> {
  try {
    const parsed = confirmUploadSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Podaci o fotografiji nisu ispravni.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.eventId, 'invitation:edit');

    const asset = await confirmUpload({
      assetId: parsed.data.assetId,
      eventId: parsed.data.eventId,
      width: parsed.data.width,
      height: parsed.data.height,
      altText: parsed.data.altText,
      placeholder: parsed.data.placeholder,
    });

    return success(asset);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function deleteMediaAction(
  input: unknown,
): Promise<ActionResult<{ assetId: string }>> {
  try {
    const parsed = deleteMediaSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Zahtev nije u očekivanom obliku.');
    }

    await requireEventAccess(parsed.data.eventId, 'invitation:edit');
    await deleteMedia(parsed.data.assetId, parsed.data.eventId);

    return success({ assetId: parsed.data.assetId });
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateMediaAltAction(
  input: unknown,
): Promise<ActionResult<{ assetId: string }>> {
  try {
    const parsed = updateMediaAltSchema.safeParse(input);
    if (!parsed.success) {
      return failure('validation', 'Opis fotografije nije ispravan.', {
        fieldErrors: zodFieldErrors(parsed.error.issues),
      });
    }

    await requireEventAccess(parsed.data.eventId, 'invitation:edit');
    await updateMediaAlt(
      parsed.data.assetId,
      parsed.data.eventId,
      parsed.data.altText,
    );

    return success({ assetId: parsed.data.assetId });
  } catch (error) {
    return toActionFailure(error);
  }
}
