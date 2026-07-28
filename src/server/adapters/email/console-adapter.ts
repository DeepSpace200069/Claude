import { randomUUID } from 'node:crypto';

import type { EmailAdapter, EmailMessage, EmailSendResult } from './types';

/**
 * Development adapter.
 *
 * Ispisuje poruku u terminal umesto slanja. Linkovi se izdvajaju posebno da bi
 * magic link mogao da se otvori jednim klikom iz terminala.
 */
export class ConsoleEmailAdapter implements EmailAdapter {
  readonly name = 'console';

  constructor(private readonly options: { from: string }) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const id = randomUUID();
    const recipients = Array.isArray(message.to)
      ? message.to.join(', ')
      : message.to;
    const links = [...message.text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);

    console.log(
      [
        '',
        '─'.repeat(72),
        `EMAIL (nije poslat - EMAIL_DRIVER=console)`,
        `Od:     ${this.options.from}`,
        `Za:     ${recipients}`,
        `Naslov: ${message.subject}`,
        links.length ? `Linkovi:\n  ${links.join('\n  ')}` : '',
        '─'.repeat(72),
        message.text.trim(),
        '─'.repeat(72),
        '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    return { ok: true, id };
  }
}
