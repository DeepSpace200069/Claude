/**
 * Storage adapter za fotografije (zahtev 3 i 24).
 *
 * Aplikacija nikad ne prima binarni sadržaj direktno: traži se potpisan URL,
 * pa pregledač šalje fajl pravo u storage. Zbog toga adapter mora da validira
 * tip i veličinu **pre** izdavanja URL-a.
 */
/**
 * Formati koje primamo pri otpremanju.
 *
 * Namerno bez AVIF-a i HEIC-a: iz njih ne umemo pouzdano da uklonimo EXIF
 * (vidi `src/lib/image-metadata.ts`), a zahtev 24 traži uklanjanje lokacije iz
 * fotografije. Korisnik zbog toga ne gubi ništa - uređivač prekodira svaku
 * izabranu fotografiju u WebP pre slanja, pa i AVIF sa telefona prolazi.
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Gornja granica veličine fotografije: 12 MB. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export const MIME_EXTENSIONS: Record<AllowedMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
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
  /**
   * Prvih `length` bajtova otpremljenog fajla.
   *
   * Postoji zbog provere metapodataka posle otpremanja: pregledač šalje fajl
   * pravo u storage, pa je ovo jedini način da server proveri šta je zaista
   * stiglo, bez povlačenja celog fajla kroz aplikaciju (zahtev 24).
   */
  readHead(storageKey: string, length: number): Promise<Uint8Array | null>;
  /**
   * Upis fajla sa servera, bez potpisanog URL-a.
   *
   * Postoji zbog uvoza HTML šablona: fajlove šablona ne otprema pregledač nego
   * CLI koji ih čita sa diska. Zato ovde nema ograničenja tipa i veličine iz
   * `validateUpload` - to su pravila za sadržaj korisnika, a šablone uvozi
   * administrator (zahtev 39.3).
   */
  putObject(
    storageKey: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<void>;
  /** Ceo fajl; koristi ga ruta koja servira fajlove šablona sa našeg domena. */
  readObject(storageKey: string): Promise<Uint8Array | null>;
}

/** Koliko početnih bajtova čitamo pri proveri metapodataka. */
export const METADATA_SCAN_BYTES = 64 * 1024;

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
