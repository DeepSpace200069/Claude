/**
 * Email adapter (zahtev 28).
 *
 * Poslovna logika nikad ne zna koji provajder šalje poštu: zna samo za
 * `EmailAdapter`. Zbog toga se Resend može zameniti bilo čim drugim bez izmena
 * izvan `src/server/adapters/email`.
 */
export type EmailAddress = string;

export type EmailMessage = {
  to: EmailAddress | EmailAddress[];
  subject: string;
  html: string;
  text: string;
  replyTo?: EmailAddress;
  /** Oznaka za grupisanje u logovima i statistici provajdera. */
  tag?: string;
};

export type EmailSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export interface EmailAdapter {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
