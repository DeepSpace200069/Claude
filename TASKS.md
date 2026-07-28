# Plan implementacije

Status po fazama. Aplikacija mora ostati u funkcionalnom stanju na kraju svake
faze — nijedna faza ne sme da ostavi polovične ekrane ili dugmad koja ne rade.

Legenda: ✅ gotovo · 🔄 u toku · ⬜ nije započeto

---

## Faza 1 — Osnova ✅

| # | Zadatak | Status |
|---|---------|--------|
| 1.1 | Projekat: Next.js 16 (App Router), React 19, TypeScript strict, Tailwind v4 | ✅ |
| 1.2 | Alati: ESLint (flat config), Vitest, Playwright, Drizzle Kit, Docker Compose | ✅ |
| 1.3 | Design system: tokeni, paleta, tipografija, UI primitivi | ✅ |
| 1.4 | Pristupačne komponente: dugme, polje, dijalog, meni, select, tabovi, toast | ✅ |
| 1.5 | i18n: sr-Latn, sr-Cyrl, en, de + množina i formati po locale-u | ✅ |
| 1.6 | Baza: kompletna šema (36 tabela), indeksi, strani ključevi, CHECK ograničenja | ✅ |
| 1.7 | Migracije: generisane + ručna migracija integritetskih pravila | ✅ |
| 1.8 | Auth.js v5: magic link preko email adaptera, opciona Google prijava | ✅ |
| 1.9 | Autorizacija: matrica dozvola, provera vlasništva, zaštita od IDOR-a | ✅ |
| 1.10 | Adapteri: email (console/Resend), storage (local/S3), naplata (dev/manual) | ✅ |
| 1.11 | Feature entitlements: centralni sistem prava po paketu | ✅ |
| 1.12 | Registar sekcija: definicije, Zod šeme, verzionisanje, migracije podataka | ✅ |
| 1.13 | Event CRUD: čarobnjak (korak 1–2), lista, dashboard, podešavanja, brisanje | ✅ |
| 1.14 | Profil korisnika: ime, jezik, učestalost obaveštenja | ✅ |
| 1.15 | Marketing okvir: početna stranica, zaglavlje, podnožje, prebacivanje jezika | ✅ |
| 1.16 | Seed: 7 vrsta proslava, 3 paketa, 8 tema, 8 šablona, demo venčanje | ✅ |
| 1.17 | Testovi: 135 unit + 18 integracionih + 15 E2E | ✅ |
| 1.18 | Dokumentacija: README, TASKS, `.env.example`, dijagrami | ✅ |

## Faza 2 — Marketing i šabloni ✅

| # | Zadatak | Status |
|---|---------|--------|
| 2.1 | `/sabloni` — galerija svih šablona | ✅ |
| 2.2 | `/sabloni/[tip]` — galerija po vrsti proslave | ✅ |
| 2.3 | Filteri: stil, dominantna boja, sa/bez fotografija, sortiranje, favoriti | ✅ |
| 2.4 | Detaljna stranica šablona | ✅ |
| 2.5 | `/demo/[templateSlug]` — live demo sa prikazom na telefonu i desktopu | ✅ |
| 2.6 | Korak 3 čarobnjaka: izbor šablona | ✅ |
| 2.7 | Stranice: kako funkcioniše, cenovnik, česta pitanja, kontakt | ✅ |
| 2.8 | Pravne stranice: uslovi korišćenja, politika privatnosti | ✅ |
| 2.9 | SEO: sitemap, canonical, Open Graph, structured data | ✅ |

## Faza 3 — Modularni uređivač ⬜

| # | Zadatak | Status |
|---|---------|--------|
| 3.1 | Editor komponente za svaki tip sekcije (lazy-loaded) | ⬜ |
| 3.2 | ~~Renderer komponente~~ — urađeno u Fazi 2 (trebale su demo stranici) | ✅ |
| 3.3 | Biblioteka sekcija i dodavanje | ⬜ |
| 3.4 | Promena redosleda: dnd-kit + pristupačna alternativa (tastatura) | ⬜ |
| 3.5 | Uključi/isključi, dupliraj, obriši, resetuj sekciju | ⬜ |
| 3.6 | Undo/redo | ⬜ |
| 3.7 | Autosave: debounce, revizije, detekcija konflikta, indikator stanja | ⬜ |
| 3.8 | Upozorenje o nesačuvanim izmenama pri napuštanju stranice | ⬜ |
| 3.9 | Preview: telefon / tablet / desktop / full-screen | ⬜ |
| 3.10 | Uređivanje teme: paleta, fontovi, pozadina, gustina, animacije | ⬜ |
| 3.11 | Provera kontrasta pri izmeni palete | ⬜ |
| 3.12 | Promena šablona bez gubitka osnovnih podataka | ⬜ |
| 3.13 | Mobilni raspored uređivača (tabovi / bottom sheet) | ⬜ |
| 3.14 | Upload fotografija kroz storage adapter (uklanjanje EXIF lokacije) | ⬜ |

## Faza 4 — Javna pozivnica ⬜

| # | Zadatak | Status |
|---|---------|--------|
| 4.1 | `/p/[publicSlug]` — javni renderer (odvojen bundle od uređivača) | ⬜ |
| 4.2 | Privatnost: javno / neindeksirano / PIN / samo personalizovani linkovi | ⬜ |
| 4.3 | Datum isteka i ručno deaktiviranje | ⬜ |
| 4.4 | Open Graph i podaci link preview kartice | ⬜ |
| 4.5 | QR kod i preuzimanje | ⬜ |
| 4.6 | Deljenje: Web Share API, WhatsApp, Viber, email, SMS | ⬜ |
| 4.7 | Keširanje javne stranice i invalidacija posle izmene | ⬜ |
| 4.8 | Uvodna animacija sa mogućnošću preskakanja | ⬜ |
| 4.9 | Statistika pregleda (dnevni agregat, bez ličnih podataka) | ⬜ |

## Faza 5 — Gosti i RSVP ⬜

| # | Zadatak | Status |
|---|---------|--------|
| 5.1 | Upravljanje gostima: dodavanje, izmena, tagovi, privatne beleške | ⬜ |
| 5.2 | Domaćinstva i grupno vođenje | ⬜ |
| 5.3 | Personalizovani tokeni i `/p/[slug]/rsvp/[token]` | ⬜ |
| 5.4 | RSVP forma sa zaštitom od spama i rate limitom | ⬜ |
| 5.5 | Dodatna pitanja (svih 6 tipova) i uslovni prikaz | ⬜ |
| 5.6 | Kasnija izmena odgovora preko sigurnog linka | ⬜ |
| 5.7 | Pregled odgovora: filtriranje, pretraga, sortiranje | ⬜ |
| 5.8 | CSV import i CSV/Excel export | ⬜ |
| 5.9 | Statistika RSVP-a na dashboardu | ⬜ |
| 5.10 | Podsetnici: filtriranje gostiju bez odgovora i generisanje poruke | ⬜ |
| 5.11 | Knjiga želja sa moderacijom | ⬜ |

## Faza 6 — Raspored sedenja ⬜

| # | Zadatak | Status |
|---|---------|--------|
| 6.1 | Sale i platno za raspored | ⬜ |
| 6.2 | Stolovi: oblici, kapacitet, položaj, rotacija, dupliranje | ⬜ |
| 6.3 | Drag-and-drop gostiju + pristupačna alternativa | ⬜ |
| 6.4 | Lista neraspoređenih, kapacitet, upozorenja o prekoračenju | ⬜ |
| 6.5 | Preferencije sedenja i upozorenja | ⬜ |
| 6.6 | Verzije rasporeda i zaključavanje | ⬜ |
| 6.7 | Export: PDF plana sale, PDF po stolovima, CSV, print prikaz | ⬜ |

## Faza 7 — Naplata i administracija ⬜

| # | Zadatak | Status |
|---|---------|--------|
| 7.1 | Tok objavljivanja: narudžbina → plaćanje → aktivan javni link | ⬜ |
| 7.2 | Webhook ruta sa proverom potpisa i idempotentnom obradom | ⬜ |
| 7.3 | Promo kodovi i besplatne admin aktivacije | ⬜ |
| 7.4 | Stranica „plan i naplata” | ⬜ |
| 7.5 | Admin: korisnici, narudžbine, prijavljeni sadržaj, statistika | ⬜ |
| 7.6 | Admin: uređivanje šablona, draft → objavljena verzija, arhiviranje | ⬜ |
| 7.7 | Admin: vrste događaja, paketi i limiti | ⬜ |
| 7.8 | Pregled audit loga | ⬜ |
| 7.9 | Saradnici: pozivanje, dozvole, prihvatanje poziva | ⬜ |

## Faza 8 — Stabilizacija ⬜

| # | Zadatak | Status |
|---|---------|--------|
| 8.1 | Bezbednosna revizija (uključujući rate limit na deljenoj infrastrukturi) | ⬜ |
| 8.2 | Revizija pristupačnosti (WCAG AA) | ⬜ |
| 8.3 | Performanse: bundle, slike, fontovi, broj upita | ⬜ |
| 8.4 | Email obaveštenja: svi šabloni + poštovanje učestalosti | ⬜ |
| 8.5 | Privatnost: preuzimanje podataka, brisanje naloga, retencija | ⬜ |
| 8.6 | Cookie consent za neobavezne kolačiće | ⬜ |
| 8.7 | Kompletiranje E2E scenarija iz specifikacije (koraci 7–12) | ⬜ |
| 8.8 | Priprema za deployment i dokumentacija operacija | ⬜ |

---

## Poznata ograničenja na kraju Faze 2

Sve navedeno je svesna odluka o obimu, a ne propust:

- **Uređivač pozivnice** (`/app/dogadjaji/[id]/editor`) još ne postoji. Registar
  sekcija, Zod šeme, migracije verzija i **svi rendereri** su gotovi i pokriveni
  testovima; nedostaju `Editor` komponente (Faza 3).
- **Javna pozivnica** (`/p/[slug]`) se još ne renderuje, iako je renderer gotov i
  radi na demo stranicama. Nedostaju privatnost, keširanje i deljenje (Faza 4).
  Slug se rezerviše i proverava od prvog dana, pa link zaista ostaje stabilan.
- **Fotografije** još nema — upload dolazi u Fazi 3. Sekcije sa slikama su
  napisane tako da bez fotografija izostave prazna mesta umesto da prikažu rupe.
- **Pravni dokumenti** (uslovi, politika privatnosti) su radna verzija napisana
  prema stvarnom ponašanju aplikacije. Pre puštanja u rad treba da ih pregleda
  pravnik; stranice to i kažu korisniku.
- **Prevodi dugih tekstova** (česta pitanja, pravni dokumenti) postoje na srpskoj
  latinici i engleskom; ostali jezici padaju na njih uz vidljivu napomenu.
- **RSVP, gosti i raspored sedenja** postoje u bazi i u modelu dozvola, ali bez
  korisničkog interfejsa (Faze 5–6).
- **Naplata** ima adapter, model narudžbine i prelaze stanja sa testovima; tok
  objavljivanja se sklapa u Fazi 7.
- **Rate limiting** je in-memory i važi po instanci procesa. Za više instanci
  potrebna je deljena implementacija (Redis) — interfejs je već izdvojen.
- **Preuzimanje i brisanje korisničkih podataka** su najavljeni u interfejsu, ali
  se do Faze 8 obrađuju ručno; nema dugmadi koja ne rade.
