'use client';

import { useEffect } from 'react';

/**
 * Prijava pregleda javne pozivnice (zahtev 27).
 *
 * Zašto iz pregledača, a ne na serveru pri renderovanju: javna stranica je
 * keširana, pa se serverski kod ne izvršava za svaki pregled. Ovako se broji
 * ono što je zaista otvoreno, a stranica ostaje keširana.
 *
 * Šalje se **samo** podatak da je pozivnica otvorena i da li je poseta prva u
 * ovoj sesiji pregledača. Nema identifikatora, nema kolačića, nema ničega što
 * bi gosta prepoznalo - server upisuje isključivo dnevni zbir.
 */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `pozivnica-poseta-${slug}`;
    let firstVisit = true;

    try {
      firstVisit = window.sessionStorage.getItem(key) === null;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Privatni režim ume da zabrani `sessionStorage`; poseta se tada broji
      // kao prva, što je bezopasno preterivanje u odnosu na gubitak podatka.
    }

    const controller = new AbortController();

    void fetch(`/api/p/${encodeURIComponent(slug)}/pregled`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstVisit }),
      signal: controller.signal,
      keepalive: true,
    }).catch(() => {
      // Statistika nikad ne sme da naruši prikaz pozivnice.
    });

    return () => controller.abort();
  }, [slug]);

  return null;
}
