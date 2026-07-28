/**
 * Storage adapter za fotografije (zahtev 3 i 24).
 *
 * Aplikacija nikad ne prima binarni sadržaj direktno: traži se potpisan URL,
 * pa pregledač šalje fajl pravo u storage. Zbog toga adapter mora da validira
 * tip i veličinu **pre** izdavanja URL-a.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type AllowedMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Gornja granica veličine fotografije: 12 MB. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export const MIME_EXTENSIONS: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export type UploadRequest = {
  /** Logička putanja (`events/<id>/gallery`). */
  prefix: string;
  mimeType: string;
  sizeBytes: number;
};

export type UploadTicket = {
  /** Ključ pod kojim fajl živi u storage-u. */
  storageKey: string;
  /** URL na koji pregledač šalje `PUT` zahtev. */
  uploadUrl: string;
  /** HTTP metoda i zaglavlja koja klijent mora da pošalje. */
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  expiresAt: Date;
};

export interface StorageAdapter {
  readonly name: string;
  createUploadTicket(request: UploadRequest): Promise<UploadTicket>;
  getPublicUrl(storageKey: string): string;
  delete(storageKey: string): Promise<void>;
}

export type ValidationError = { code: string; message: string };

/**
 * Provera tipa i veličine fajla.
 *
 * Vraća grešku umesto da baca izuzetak jer isti kod koristi i klijent (za
 * trenutnu poruku) i server (kao stvarna odbrana).
 */
export function validateUpload(request: {
  mimeType: string;
  sizeBytes: number;
}): ValidationError | null {
  if (
    !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(request.mimeType)
  ) {
    return {
      code: 'unsupported_type',
      message:
        'Dozvoljene su samo fotografije u formatu JPG, PNG, WebP ili AVIF.',
    };
  }

  if (!Number.isFinite(request.sizeBytes) || request.sizeBytes <= 0) {
    return { code: 'invalid_size', message: 'Veličina fajla nije ispravna.' };
  }

  if (request.sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      code: 'too_large',
      message: `Fotografija je prevelika. Najviše ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    };
  }

  return null;
}
