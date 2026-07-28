import type { EmailAdapter, EmailMessage, EmailSendResult } from './types';

/**
 * Resend adapter.
 *
 * Koristi direktno HTTP API umesto SDK-a: jedan `fetch` poziv nema smisla
 * plaćati dodatnom zavisnošću, a ovako adapter radi i na Edge runtime-u.
 */
export class ResendEmailAdapter implements EmailAdapter {
  readonly name = 'resend';

  constructor(private readonly options: { apiKey: string; from: string }) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.options.apiKey) {
      return { ok: false, error: 'RESEND_API_KEY nije postavljen.' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.options.from,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          ...(message.tag ? { tags: [{ name: 'kind', value: message.tag }] } : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          ok: false,
          error: `Resend je odgovorio ${response.status}: ${body.slice(0, 300)}`,
        };
      }

      const data = (await response.json()) as { id?: string };
      return { ok: true, id: data.id ?? 'unknown' };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Nepoznata greška.',
      };
    }
  }
}
