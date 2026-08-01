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

## Faza 3 — Modularni uređivač ✅

| # | Zadatak | Status |
|---|---------|--------|
| 3.1 | Editor komponente za svaki tip sekcije (lenjo učitane, `ssr: false`) | ✅ |
| 3.2 | ~~Renderer komponente~~ — urađeno u Fazi 2 (trebale su demo stranici) | ✅ |
| 3.3 | Biblioteka sekcija i dodavanje (zaključane sekcije vidljive, ne skrivene) | ✅ |
| 3.4 | Promena redosleda: dnd-kit + dugmad, tastatura i najave čitaču ekrana | ✅ |
| 3.5 | Uključi/isključi, dupliraj, obriši, resetuj sekciju | ✅ |
| 3.6 | Undo/redo sa objedinjavanjem uzastopnih izmena istog polja | ✅ |
| 3.7 | Autosave: debounce, revizije, detekcija konflikta, indikator stanja | ✅ |
| 3.8 | Upozorenje o nesačuvanim izmenama pri napuštanju stranice | ✅ |
| 3.9 | Preview: telefon / tablet / desktop / preko celog ekrana | ✅ |
| 3.10 | Uređivanje teme: paleta, fontovi, pozadina, gustina, animacije | ✅ |
| 3.11 | Provera kontrasta pri izmeni palete (WCAG AA, uživo) | ✅ |
| 3.12 | Promena šablona bez gubitka osnovnih podataka | ✅ |
| 3.13 | Mobilni raspored uređivača (tabovi, jedno stablo za sve širine) | ✅ |
| 3.14 | Upload fotografija kroz storage adapter (uklanjanje EXIF lokacije) | ✅ |

## Faza 4 — Javna pozivnica ✅

| # | Zadatak | Status |
|---|---------|--------|
| 4.1 | `/p/[publicSlug]` — javni renderer (odvojen bundle od uređivača) | ✅ |
| 4.2 | Privatnost: javno / neindeksirano / PIN / samo personalizovani linkovi | ✅ |
| 4.3 | Datum isteka i ručno deaktiviranje | ✅ |
| 4.4 | Open Graph i podaci link preview kartice (poštuju privatnost) | ✅ |
| 4.5 | QR kod i preuzimanje (SVG i PNG) | ✅ |
| 4.6 | Deljenje: Web Share API, WhatsApp, Viber, email, SMS | ✅ |
| 4.7 | Keširanje javne stranice i invalidacija posle izmene | ✅ |
| 4.8 | Uvodna animacija sa mogućnošću preskakanja | ✅ |
| 4.9 | Statistika pregleda (dnevni agregat, bez ličnih podataka) | ✅ |

## Faza 5 — Gosti i RSVP ✅

| # | Zadatak | Status |
|---|---------|--------|
| 5.1 | Upravljanje gostima: dodavanje, izmena, tagovi, privatne beleške | ✅ |
| 5.2 | Domaćinstva i grupno vođenje | ✅ |
| 5.3 | Personalizovani tokeni i `/p/[slug]/[token]` | ✅ |
| 5.4 | RSVP forma sa zaštitom od spama i rate limitom | ✅ |
| 5.5 | Dodatna pitanja (svih 6 tipova) i uslovni prikaz | ✅ |
| 5.6 | Kasnija izmena odgovora preko sigurnog linka | ✅ |
| 5.7 | Pregled odgovora: filtriranje, pretraga, sortiranje | ✅ |
| 5.8 | CSV uvoz i CSV izvoz (gosti i odgovori) | ✅ |
| 5.9 | Statistika RSVP-a na dashboardu | ✅ |
| 5.10 | Podsetnici: filtriranje gostiju bez odgovora i spisak za slanje | ✅ |
| 5.11 | Knjiga želja sa moderacijom | ✅ |

## Faza 6 — Raspored sedenja ✅

| # | Zadatak | Status |
|---|---------|--------|
| 6.1 | Sale i platno za raspored | ✅ |
| 6.2 | Stolovi: oblici, kapacitet, položaj, rotacija, dupliranje | ✅ |
| 6.3 | Prevlačenje gostiju + ravnopravna alternativa bez miša | ✅ |
| 6.4 | Lista neraspoređenih, kapacitet, upozorenja o prekoračenju | ✅ |
| 6.5 | Preferencije sedenja i upozorenja | ✅ |
| 6.6 | Verzije rasporeda i zaključavanje | ✅ |
| 6.7 | CSV izvoz i prikaz za štampu iz kog pregledač pravi PDF | ✅ |

## Faza 7 — Naplata i administracija ✅

| # | Zadatak | Status |
|---|---------|--------|
| 7.0 | Paket po pozivnici: prava vezana za događaj, ne za nalog | ✅ |
| 7.1 | Tok objavljivanja: narudžbina → plaćanje → aktivan javni link | ✅ |
| 7.2 | Webhook ruta sa proverom potpisa i idempotentnom obradom | ✅ |
| 7.3 | Promo kodovi i besplatne admin aktivacije | ✅ |
| 7.4 | Stranica „plan i naplata” | ✅ |
| 7.5 | Admin: korisnici, narudžbine, statistika | ✅ |
| 7.6 | Admin: šabloni, draft → objavljena verzija, arhiviranje | ✅ |
| 7.7 | Admin: vrste događaja, paketi i limiti | ✅ |
| 7.8 | Pregled audit loga | ✅ |
| 7.9 | Saradnici: pozivanje, dozvole, prihvatanje poziva | ✅ |

## Faza 8 — Stabilizacija ✅

| # | Zadatak | Status |
|---|---------|--------|
| 8.1 | Bezbednosna revizija (uključujući rate limit na deljenoj infrastrukturi) | ✅ |
| 8.2 | Revizija pristupačnosti (WCAG AA) | ✅ |
| 8.3 | Performanse: bundle, slike, fontovi, broj upita | ✅ |
| 8.4 | Email obaveštenja: svi šabloni + poštovanje učestalosti | ✅ |
| 8.5 | Privatnost: preuzimanje podataka, brisanje naloga, retencija | ✅ |
| 8.6 | Cookie consent za neobavezne kolačiće | ✅ |
| 8.7 | Kompletiranje E2E scenarija iz specifikacije (koraci 7–12) | ✅ |
| 8.8 | Priprema za deployment i dokumentacija operacija | ✅ |

---

## Faza 9 — HTML šabloni (uvoz gotovih sajtova)

Druga vrsta šablona, uporedo sa sekcijama: gotov ručno pravljen sajt sa
sopstvenim animacijama, koji se **ne prevodi** u sekcije. Postojeći šabloni od
sekcija rade neizmenjeno.

| # | Zadatak | Status |
|---|---------|--------|
| 9.1 | Model podataka: `templates.kind`, HTML kolone verzije, polja pozivnice, Zod ugovor | ✅ |
| 9.2 | Uvoznik (CLI): dva prolaza, preuzimanje spoljnih resursa, zamena mapa i RSVP forme, provera | ✅ |
| 9.3 | Uređivač polja umesto uređivača sekcija (živi pregled, ruta za fajlove šablona) | ✅ |
| 9.4 | Javni prikaz uvezenog sajta sa pravom RSVP formom | ⬜ |
| 9.5 | Admin, E2E testovi, dokumentacija | ⬜ |

---

## Poznata ograničenja na kraju Faze 8

Sve navedeno je svesna odluka o obimu, a ne propust:

- **Šablon se ne menja između vrsta.** Pozivnica od sekcija bira druge šablone od
  sekcija, a pozivnica od uvezenog sajta druge gotove sajtove. Sadržaj nema
  zajednički oblik, pa bi prelazak između vrsta bio tiho brisanje svega unetog -
  vrsta se bira jednom, pri pravljenju pozivnice.
- **Uređivač polja nema „poništi/ponovi".** Tamo gde se menja struktura istorija
  poteza je jedina odbrana od gubitka rada; ovde je sadržaj ravan skup polja, pa
  poništavanje kucanja radi pregledač, po polju. Istorija verzija postoji i za
  HTML pozivnice.

- **Objavljivanje traži paket sa pravom `publish`.** Paket se kupuje **po
  pozivnici**: plaćeno venčanje ne otključava sledeći događaj. Na besplatnom
  paketu dugme postoji, ali je onemogućeno uz tačan razlog i vezu ka naplati baš
  te pozivnice — nema lažnog uspeha.
- **Nijedan provajder još stvarno ne naplaćuje.** Postoje dva adaptera: `dev`
  (ne sme u produkciju, fabrika ga odbija) i `manual` (uplatnica i bankovni
  transfer — narudžbina čeka dok je administrator ne potvrdi uz obavezan
  razlog). Adapter za kartično plaćanje se dodaje bez izmena poslovne logike,
  jer sve ide kroz `PaymentAdapter`.
- **Idempotencija naplate stoji na bazi, ne na kodu.** Tri jedinstvena indeksa —
  `orders (idempotency_key)`, `payments (provider, provider_ref)` i
  `webhook_events (provider, external_id)` — hvataju dvostruki klik, ponovljen
  poziv provajderu i ponovljenu isporuku webhooka. Kod ne proverava „postoji li
  već” pa upisuje; upisuje, pa hvata sudar.
- **Brisanje naloga sa narudžbinama nije rešeno.** `orders.user_id` je
  namerno `on delete restrict` — finansijski trag ne sme da nestane zato što je
  neko obrisao nalog. Tok brisanja naloga (anonimizacija umesto brisanja) je
  posao Faze 8, zadatak 8.5.
- **Poziv saradniku šaljemo mejlom, ali link ne prikazujemo u interfejsu.** Ako
  slanje ne uspe, interfejs to kaže i poziv ostaje zapisan; ponovni poziv iste
  adrese osvežava token i rok.
- **Spisak gostiju traži paket sa granicom `maxGuests`.** Besplatan paket ima
  granicu 0, pa stranica gostiju to kaže odmah, iznad spiska, umesto da pusti
  korisnika da popuni formu pa dobije odbijenicu. Server istu granicu proverava
  u akciji i u uvozu.
- **Podsetnike ne šaljemo mi.** Stranica odgovora daje spisak gostiju bez
  odgovora i njihove kontakte za kopiranje, a poruku šalje organizator svojim
  kanalom. Kontakt gosta je dat organizatoru za tu proslavu, a ne nama za
  slanje; automatsko slanje bi tražilo posebnu saglasnost gosta.
- **Zaštita javnih formi** je polje-mamac, potpisani ključ obrasca sa donjom
  granicom vremena i ograničenje po otisku klijenta (sada u bazi, pa važi za sve
  instance). To pokriva automatizovano zatrpavanje, ali **nije** CAPTCHA:
  napadač koji jednom učita stranicu dobija ispravan ključ.
- **CSP zadržava `'unsafe-inline'` za skripte.** Next ubacuje inline RSC podatke
  u svaku stranicu, a nonce mora da se računa po zahtevu, što isključuje
  keširanje cele rute - a javna pozivnica se namerno kešira. Umesto lažnog
  izbora, uklonjen je razlog za XSS: aplikacija nigde ne prikazuje korisnički
  HTML.
- **Merenje jedinstvenih posetilaca čeka pristanak.** Bez njega se pregled i
  dalje broji, ali kao ponovljen, pa je broj jedinstvenih posetilaca manji od
  stvarnog. To je svesna zamena: radije netačan broj nego merenje bez pitanja.
- **Automatska provera pristupačnosti hvata oko trećine problema.** `axe` ne zna
  ništa o smislu teksta ni o redosledu fokusa; ono što ne vidi provereno je
  ručno i zapisano u samom testu.
- **Odgovor bez ličnog linka se ne spaja po imenu.** Dva gosta sa istim imenom
  su realnost, pa javni RSVP uvek pravi nov odgovor; spajanje bi tiho prepisalo
  tuđu potvrdu. Preko ličnog linka odgovor je jedan i menja se.
- **PDF rasporeda pravi pregledač, ne server.** Prikaz za štampu ima `@page`
  pravila i prelome koji ne cepaju sto, pa „Sačuvaj kao PDF" daje ispravan
  dokument sa našim fontovima. Serverski generisan PDF sa ugrađenim standardnim
  fontovima nema srpska slova (ć, č, đ), a „Petrovi?" umesto „Petrović" bilo bi
  gore od odsustva dugmeta. Ugrađivanje fonta je posao Faze 8.
- **Pravila sedenja su upozorenja, ne zabrane.** „Sedi sa" i „ne sedi sa" se
  prikazuju kao upozorenje; raspored se svejedno čuva. Organizator zna svoju
  porodicu bolje od nas, a raspored koji se ne može sačuvati zbog jednog pravila
  bio bi gori od žutog upozorenja.
- **Raspored sedenja traži paket sa mogućnošću `seating`.** Stranica se
  prikazuje uz jasnu poruku, ali izmene su onemogućene i server ih odbija.
- **Statistika** broji preglede iz pregledača (mali `fetch` posle učitavanja), pa
  je javna stranica keširana. Posetilac bez JavaScripta se ne broji — svesna
  zamena: keširana stranica za sve umesto tačnog brojanja za nekolicinu.
- **Jedinstveni posetioci** se broje po sesiji pregledača, bez kolačića i bez
  identifikatora. Isti gost sa dva uređaja broji se dvaput; to je cena toga što
  ne pratimo ljude.
- **Slug se ne može menjati** iz interfejsa. Servis `changeInvitationSlug`
  postoji i proverava format i zauzetost, ali stranica za to dolazi kasnije —
  menjanje već podeljenog linka je opasna radnja i traži jasno upozorenje.
- **Pravni dokumenti** su radna verzija napisana prema stvarnom ponašanju
  aplikacije; pre puštanja u rad treba da ih pregleda pravnik, i stranica to kaže.
- **Raspored sedenja** postoji u bazi i u modelu dozvola, ali bez korisničkog
  interfejsa (Faza 6).
- **Rate limiting** je in-memory i važi po instanci procesa. Za više instanci
  potrebna je deljena implementacija (Redis) — interfejs je već izdvojen.
- **Preuzimanje i brisanje korisničkih podataka** su najavljeni u interfejsu, ali
  se do Faze 8 obrađuju ručno; nema dugmadi koja ne rade.
