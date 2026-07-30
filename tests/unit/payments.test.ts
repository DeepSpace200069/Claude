import { describe, expect, it } from 'vitest';

import { DevPaymentAdapter } from '@/server/adapters/payments/dev-adapter';
import {
  canTransition,
  transition,
  type PaymentStatus,
} from '@/server/adapters/payments/types';

describe('prelazi stanja naplate', () => {
  it('dozvoljava normalan tok', () => {
    expect(canTransition('pending', 'succeeded')).toBe(true);
    expect(canTransition('pending', 'failed')).toBe(true);
    expect(canTransition('succeeded', 'refunded')).toBe(true);
    expect(canTransition('failed', 'pending')).toBe(true);
  });

  it('ne dozvoljava vraćanje uspešne naplate u čekanje', () => {
    expect(canTransition('succeeded', 'pending')).toBe(false);
    expect(canTransition('succeeded', 'failed')).toBe(false);
  });

  it('povraćaj je konačno stanje', () => {
    const finalStates: PaymentStatus[] = ['pending', 'succeeded', 'failed'];
    for (const target of finalStates) {
      expect(canTransition('refunded', target)).toBe(false);
    }
  });

  it('ponovljeni isti status je dozvoljen (webhookovi se ponavljaju)', () => {
    for (const status of ['pending', 'succeeded', 'failed', 'refunded'] as PaymentStatus[]) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it('transition vraća opisnu grešku za nedozvoljen prelaz', () => {
    const result = transition('succeeded', 'pending');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('succeeded -> pending');
  });
});

describe('development payment provajder', () => {
  const adapter = new DevPaymentAdapter({ webhookSecret: 'test-secret' });

  const baseInput = {
    orderId: 'order-1',
    amountMinor: 290000,
    currency: 'RSD',
    description: 'Objavljivanje pozivnice',
    returnUrl: 'http://localhost:3000/app/dogadjaji/1',
  };

  it('nije dozvoljen u produkciji', () => {
    expect(adapter.allowedInProduction).toBe(false);
  });

  it('nikad ne vraća uspeh odmah', async () => {
    const intent = await adapter.createIntent({
      ...baseInput,
      idempotencyKey: 'kljuc-a',
    });
    expect(intent.status).toBe('pending');
  });

  it('isti idempotency ključ daje isti nalog', async () => {
    const first = await adapter.createIntent({ ...baseInput, idempotencyKey: 'kljuc-b' });
    const second = await adapter.createIntent({ ...baseInput, idempotencyKey: 'kljuc-b' });
    expect(second.providerRef).toBe(first.providerRef);
  });

  it('različit ključ daje novi nalog', async () => {
    const first = await adapter.createIntent({ ...baseInput, idempotencyKey: 'kljuc-c' });
    const second = await adapter.createIntent({ ...baseInput, idempotencyKey: 'kljuc-d' });
    expect(second.providerRef).not.toBe(first.providerRef);
  });

  it('isti ključ daje isti nalog i posle restarta procesa', async () => {
    // Nova instanca stoji umesto restartovanog procesa (ili druge instance iza
    // balansera): keš u memoriji je prazan. Referenca zato mora da se izvede iz
    // samog ključa - inače bi ponovljeni zahtev napravio drugi nalog i naplata
    // bi se udvostručila.
    const restarted = new DevPaymentAdapter({ webhookSecret: 'test-secret' });

    const before = await adapter.createIntent({ ...baseInput, idempotencyKey: 'kljuc-e' });
    const after = await restarted.createIntent({ ...baseInput, idempotencyKey: 'kljuc-e' });

    expect(after.providerRef).toBe(before.providerRef);
  });

  it('referenca ne otkriva ključ idempotencije', async () => {
    const key = 'order-42:user-7';
    const intent = await adapter.createIntent({ ...baseInput, idempotencyKey: key });

    expect(intent.providerRef).not.toContain(key);

    // Potpis, a ne običan heš: sa drugom tajnom ista ulazna vrednost daje drugu
    // referencu, pa se ključ ne može pogoditi iz reference viđene u logu.
    const other = new DevPaymentAdapter({ webhookSecret: 'druga-tajna' });
    const otherIntent = await other.createIntent({ ...baseInput, idempotencyKey: key });

    expect(otherIntent.providerRef).not.toBe(intent.providerRef);
  });

  it('odbija webhook bez potpisa', () => {
    const result = adapter.verifyWebhook('{}', null);
    expect(result.ok).toBe(false);
  });

  it('odbija webhook sa pogrešnim potpisom', () => {
    const body = JSON.stringify({ id: 'evt_1', providerRef: 'dev_1', status: 'succeeded' });
    const result = adapter.verifyWebhook(body, 'pogresan-potpis');
    expect(result.ok).toBe(false);
  });

  it('prihvata webhook sa ispravnim potpisom', () => {
    const body = JSON.stringify({
      id: 'evt_2',
      type: 'payment.succeeded',
      providerRef: 'dev_2',
      status: 'succeeded',
      amountMinor: 290000,
    });
    const result = adapter.verifyWebhook(body, adapter.signPayload(body));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.eventId).toBe('evt_2');
      expect(result.status).toBe('succeeded');
      expect(result.amountMinor).toBe(290000);
    }
  });

  it('odbija webhook sa nepoznatim statusom', () => {
    const body = JSON.stringify({ id: 'evt_3', providerRef: 'dev_3', status: 'teleportovano' });
    const result = adapter.verifyWebhook(body, adapter.signPayload(body));
    expect(result.ok).toBe(false);
  });

  it('odbija payload koji nije JSON', () => {
    const body = 'ovo nije json';
    const result = adapter.verifyWebhook(body, adapter.signPayload(body));
    expect(result.ok).toBe(false);
  });
});
