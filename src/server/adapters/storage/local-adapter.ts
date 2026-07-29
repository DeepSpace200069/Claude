import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, open, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  MIME_EXTENSIONS,
  validateUpload,
  type AllowedMimeType,
  type StorageAdapter,
  type UploadRequest,
  type UploadTicket,
} from './types';

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

/**
 * Development storage: fajlovi se pišu u `public/uploads`.
 *
 * Klijent i ovde radi isto što i sa S3 - traži „potpisan” URL pa šalje `PUT`.
 * Potpis je pravi HMAC sa rokom trajanja, tako da lokalna ruta za otpremanje
 * ima istu proveru kao produkcija i ne postaje otvoreni upload endpoint.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'local';

  constructor(
    private readonly options: { appUrl: string; signingSecret: string },
  ) {}

  async createUploadTicket(request: UploadRequest): Promise<UploadTicket> {
    const error = validateUpload(request);
    if (error) throw new Error(error.message);

    const extension = MIME_EXTENSIONS[request.mimeType as AllowedMimeType];
    const storageKey = `${request.prefix.replace(/^\/+|\/+$/g, '')}/${randomUUID()}.${extension}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const signature = this.sign(storageKey, expiresAt.getTime());
    const uploadUrl = new URL('/api/uploads/local', this.options.appUrl);
    uploadUrl.searchParams.set('key', storageKey);
    uploadUrl.searchParams.set('expires', String(expiresAt.getTime()));
    uploadUrl.searchParams.set('signature', signature);

    return {
      storageKey,
      uploadUrl: uploadUrl.toString(),
      method: 'PUT',
      headers: { 'Content-Type': request.mimeType },
      expiresAt,
    };
  }

  getPublicUrl(storageKey: string): string {
    return `/uploads/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    const target = this.resolvePath(storageKey);
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  async readHead(storageKey: string, length: number): Promise<Uint8Array | null> {
    const target = this.resolvePath(storageKey);
    const handle = await open(target, 'r').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!handle) return null;

    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return new Uint8Array(buffer.subarray(0, bytesRead));
    } finally {
      await handle.close();
    }
  }

  /** Poziva je lokalna upload ruta pošto proveri potpis. */
  async writeFile(storageKey: string, data: Buffer): Promise<void> {
    const target = this.resolvePath(storageKey);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  sign(storageKey: string, expiresAtMs: number): string {
    return createHmac('sha256', this.options.signingSecret)
      .update(`${storageKey}:${expiresAtMs}`)
      .digest('hex');
  }

  verify(storageKey: string, expiresAtMs: number, signature: string): boolean {
    if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) return false;
    const expected = this.sign(storageKey, expiresAtMs);
    return expected.length === signature.length && expected === signature;
  }

  /**
   * Sprečava izlazak iz `public/uploads` preko `..` u ključu.
   * Bez ove provere potpisan ključ bi mogao da prepiše fajl bilo gde na disku.
   */
  private resolvePath(storageKey: string): string {
    const target = path.resolve(UPLOAD_ROOT, storageKey);
    if (target !== UPLOAD_ROOT && !target.startsWith(`${UPLOAD_ROOT}${path.sep}`)) {
      throw new Error('Neispravan ključ fajla.');
    }
    return target;
  }
}
