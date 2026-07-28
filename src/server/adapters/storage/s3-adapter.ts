import { createHash, createHmac, randomUUID } from 'node:crypto';

import {
  MIME_EXTENSIONS,
  validateUpload,
  type AllowedMimeType,
  type StorageAdapter,
  type UploadRequest,
  type UploadTicket,
} from './types';

/**
 * S3-kompatibilan storage (AWS S3, MinIO, Cloudflare R2...).
 *
 * SigV4 potpis je implementiran direktno preko `node:crypto` umesto AWS SDK-a:
 * jedini potreban poziv je presigned `PUT`, a SDK bi doneo nekoliko megabajta
 * zavisnosti u serverless bundle.
 */
export class S3StorageAdapter implements StorageAdapter {
  readonly name = 's3';

  constructor(
    private readonly options: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicUrl: string;
    },
  ) {}

  async createUploadTicket(request: UploadRequest): Promise<UploadTicket> {
    const error = validateUpload(request);
    if (error) throw new Error(error.message);

    const extension = MIME_EXTENSIONS[request.mimeType as AllowedMimeType];
    const storageKey = `${request.prefix.replace(/^\/+|\/+$/g, '')}/${randomUUID()}.${extension}`;
    const expiresInSeconds = 900;

    const uploadUrl = this.presignPut(storageKey, expiresInSeconds, request.mimeType);

    return {
      storageKey,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': request.mimeType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  getPublicUrl(storageKey: string): string {
    return `${this.options.publicUrl.replace(/\/+$/, '')}/${storageKey}`;
  }

  async delete(storageKey: string): Promise<void> {
    const url = this.presignDelete(storageKey, 300);
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Brisanje fajla nije uspelo (${response.status}).`);
    }
  }

  // --- SigV4 -------------------------------------------------------------

  private presignPut(key: string, expiresIn: number, contentType: string): string {
    return this.presign('PUT', key, expiresIn, { 'content-type': contentType });
  }

  private presignDelete(key: string, expiresIn: number): string {
    return this.presign('DELETE', key, expiresIn, {});
  }

  private presign(
    method: string,
    key: string,
    expiresIn: number,
    extraSignedHeaders: Record<string, string>,
  ): string {
    const url = new URL(
      `${this.options.endpoint.replace(/\/+$/, '')}/${this.options.bucket}/${key}`,
    );

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.options.region}/s3/aws4_request`;

    const headers: Record<string, string> = {
      host: url.host,
      ...extraSignedHeaders,
    };
    const signedHeaders = Object.keys(headers).sort().join(';');

    const query = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.options.accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': signedHeaders,
    });

    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((name) => `${name}:${headers[name]}\n`)
      .join('');

    const canonicalRequest = [
      method,
      url.pathname,
      // SigV4 zahteva sortirane parametre sa kodiranim vrednostima.
      [...query.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
        .join('&'),
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    // kSigning = HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), region), "s3"), "aws4_request")
    const hmac = (key: Buffer | string, data: string) =>
      createHmac('sha256', key).update(data).digest();

    const kDate = hmac(`AWS4${this.options.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.options.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');

    const signature = createHmac('sha256', kSigning)
      .update(stringToSign)
      .digest('hex');

    query.set('X-Amz-Signature', signature);
    url.search = query.toString();
    return url.toString();
  }
}

/** `encodeURIComponent` ne kodira `!'()*`, a SigV4 to zahteva. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
