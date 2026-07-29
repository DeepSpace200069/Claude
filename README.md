# Pozivnica

SaaS platforma za samostalno pravljenje digitalnih pozivnica — venčanja,
krštenja, prvi rođendani, punoletstva i druge privatne proslave.

Korisnik izabere vrstu proslave i šablon, uredi sadržaj kroz modularni uređivač,
objavi pozivnicu i podeli jedan stabilan link. Gosti odgovaraju bez naloga, a
organizator prati potvrde dolaska i pravi raspored sedenja.

> **Trenutno stanje: Faze 1, 2 i 3 su završene.** Osnova (baza, autentifikacija,
> autorizacija, dizajn sistem, i18n, upravljanje događajima), marketinški deo
> (galerija šablona sa filterima, live demo, cenovnik iz baze, pravne stranice,
> SEO) i **modularni uređivač pozivnice** rade i pokriveni su testovima:
> uređivanje svih 18 tipova sekcija, promena redosleda i bez miša, poništi/ponovi,
> automatsko čuvanje sa detekcijom sudara, uređivanje teme uz proveru kontrasta,
> promena šablona bez gubitka sadržaja i otpremanje fotografija sa uklanjanjem
> EXIF lokacije. Javna pozivnica, RSVP, raspored sedenja i naplata dolaze u
> fazama 4–7 — vidi [`TASKS.md`](./TASKS.md) i „Poznata ograničenja” na dnu ovog
> dokumenta.

---

## Sadržaj

- [Brzi start](#brzi-start)
- [Tehnološki stack](#tehnološki-stack)
- [Arhitektura](#arhitektura)
- [Struktura foldera](#struktura-foldera)
- [Model baze](#model-baze)
- [Registar sekcija](#registar-sekcija)
- [Uređivač pozivnice](#uređivač-pozivnice)
- [Tok kreiranja i objavljivanja](#tok-kreiranja-i-objavljivanja)
- [Adapteri](#adapteri)
- [Environment varijable](#environment-varijable)
- [Komande](#komande)
- [Testiranje](#testiranje)
- [Bezbednost](#bezbednost)
- [Deployment](#deployment)
- [Poznata ograničenja](#poznata-ograničenja)

---

## Brzi start

Potrebno je: **Node.js 20.11+**, **pnpm 10+** i **Docker** (ili lokalni
PostgreSQL 16).

```bash
# 1. Zavisnosti
pnpm install

# 2. Konfiguracija
cp .env.example .env
# Generiši tajnu za sesije i upiši je u .env kao AUTH_SECRET:
openssl rand -base64 32

# 3. Baza (PostgreSQL na portu 5432)
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 4. Pokretanje
pnpm dev
```

Aplikacija radi na <http://localhost:3000>.

### Prijava u developmentu

Prijava ide magic linkom. Sa podrazumevanim `EMAIL_DRIVER=console` **ništa se ne
šalje** — poruka se ispisuje u terminalu u kom je pokrenut `pnpm dev`, a link se
izdvaja posebno da može odmah da se otvori:

```
────────────────────────────────────────────────────────────────────────
EMAIL (nije poslat - EMAIL_DRIVER=console)
Za:     demo@pozivnica.rs
Naslov: Prijava · Pozivnica
Linkovi:
  http://localhost:3000/api/auth/callback/email?token=…
────────────────────────────────────────────────────────────────────────
```

Seed pravi dva naloga:

| Nalog | Email | Uloga |
|-------|-------|-------|
| Demo organizator | `demo@pozivnica.rs` | `user` |
| Administrator | `admin@pozivnica.rs` | `admin` |

---

## Tehnološki stack

| Sloj | Izbor | Napomena |
|------|-------|----------|
| Framework | Next.js 16, App Router | Server komponente i server akcije |
| UI | React 19, Tailwind CSS v4 | Tokeni u `src/styles/globals.css` |
| Komponente | Radix UI primitivi (shadcn pristup) | Pisane u repozitorijumu, ne kao zavisnost |
| Jezik | TypeScript, `strict` + `noUncheckedIndexedAccess` | |
| Baza | PostgreSQL 16 | |
| ORM | **Drizzle** | Obrazloženje ispod |
| Autentifikacija | Auth.js v5 (magic link + opcioni Google) | Sesije u bazi |
| Validacija | Zod v4 | Iste šeme na klijentu i na serveru |
| Forme | React Hook Form | |
| Drag & drop | dnd-kit | Uređivač i raspored sedenja (Faze 3 i 6) |
| Testovi | Vitest + Playwright | |

### Zašto Drizzle, a ne Prisma

1. **JSONB sa tipovima.** Podaci sekcija i tokeni teme se čuvaju kao JSONB.
   Drizzle dozvoljava `jsonb().$type<ThemeTokens>()`, pa je kolona tipizovana bez
   dodatnog sloja. Prisma JSON polja vraća kao `JsonValue` koji se svuda mora
   ručno sužavati.
2. **Kontrola nad SQL-om.** Potrebni su nam delimični indeksi
   (`WHERE deleted_at IS NULL`), `DEFERRABLE` strani ključevi za kružne veze
   (šablon ↔ verzija šablona) i `CHECK` ograničenja na formatu sluga i iznosima
   naplate. Sve to su plain SQL migracije koje se čitaju u code review-u.
3. **Rezervacija sluga.** Jedinstvenost javnog linka se rešava hvatanjem greške
   `23505` na `UNIQUE` indeksu, a ne provera-pa-upis. Za to je potreban direktan
   pristup grešci drajvera.
4. **Veličina bundle-a.** Nema zasebnog query engine binarnog fajla, što se na
   serverless platformi vidi u hladnom startu.

Cena izbora: relacioni upiti se pišu eksplicitnije nego u Prismi. Za ovaj model,
gde je najviše upita usko i optimizovano (dashboard, javna pozivnica), to je
prihvatljiva razmena.

---

## Arhitektura

Četiri sloja, sa jasnim pravilom u kom smeru idu zavisnosti:

```
app/          Rute i stranice (server komponente)
  ↓
features/     Domenska logika: šeme, registri, klijentske komponente
  ↓
server/       Autorizacija, servisi, akcije, adapteri, baza
  ↓
lib/ i18n/    Bez domenskog znanja: slug, ID-jevi, prevodi, formatiranje
```

Ključna pravila:

1. **Svaka serverska akcija proverava autorizaciju.** Redosled je uvek isti:
   autentifikacija → rate limit → validacija → autorizacija nad konkretnim
   resursom → posao. Skrivanje dugmeta u interfejsu nikad nije zaštita.
2. **Stranice i akcije koriste različite oblike grešaka.** Akcija vraća
   `ActionResult` koji forma prikazuje uz polje; stranica preko
   `requireEventPageAccess` vraća pravi HTTP status (404/403/redirect).
3. **Tuđi resurs izgleda isto kao nepostojeći.** `requireEventAccess` za tuđ
   događaj baca `NotFoundError`, ne `AuthorizationError` — inače bi odgovor odao
   postojanje tuđih događaja.
4. **Pozivnica pamti snimak šablona.** Tema i sekcije se pri kreiranju **kopiraju**
   iz verzije šablona. Kasnija izmena šablona ne dira postojeće pozivnice.
5. **Uređivač i javni prikaz dele model, ne bundle.** Definicije sekcija su bez
   React komponenti, a `Renderer` i `Editor` se traže iz odvojenih registara.
6. **Nijedan limit nije hardkodovan u komponenti.** Sve ide kroz
   `features/billing/entitlements`, a vrednosti dolaze iz tabele `feature_plans`.
7. **Uređivač je nepromenljiv dokument.** Sve izmene su čiste funkcije nad
   `EditorDocument`, pa su poništi/ponovi, detekcija nesačuvanih izmena i
   autosave izvedeni iz jednog izvora istine, a ne iz tri kopije stanja.
8. **Uređivač renderuje jedno stablo za sve širine ekrana.** Raspored menja samo
   CSS. Dva stabla sa `hidden` klasom značila bi dve kopije svakog polja u DOM-u
   i dve kontrole sa istim nazivom za čitač ekrana.

---

## Struktura foldera

```
.
├── docker-compose.yml          PostgreSQL + MinIO za lokalni rad
├── drizzle.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── src/
│   ├── app/
│   │   ├── (marketing)/        Početna, galerija, cenovnik…
│   │   ├── (auth)/login/       Prijava, „proverite email”, greška
│   │   ├── app/                Kontrolni panel organizatora
│   │   │   ├── dogadjaji/
│   │   │   │   ├── novi/       Čarobnjak
│   │   │   │   └── [eventId]/  Dashboard, podešavanja, uređivač, (gosti…)
│   │   │   └── profil/
│   │   ├── api/auth/           Auth.js rute
│   │   ├── api/uploads/local/  Prijem fotografija u razvojnom režimu
│   │   ├── error.tsx           Granica greške
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── brand/              Logotip (SVG, nasleđuje boju)
│   │   ├── layout/             Meni naloga, prebacivanje jezika
│   │   └── ui/                 Dizajn sistem
│   ├── config/brand.ts         Naziv, domen, kontakt — sve iz env-a
│   ├── features/
│   │   ├── auth/
│   │   ├── billing/            Entitlements (prava po paketu)
│   │   ├── editor/             UREĐIVAČ POZIVNICE
│   │   │   ├── document.ts     Model dokumenta i sve operacije (čiste funkcije)
│   │   │   ├── history.ts      Poništi/ponovi sa objedinjavanjem izmena
│   │   │   ├── store.tsx       Reducer, kontekst, radnje
│   │   │   ├── use-autosave.ts Odloženo čuvanje i detekcija sudara
│   │   │   ├── upload.ts       Prekodiranje i otpremanje fotografija
│   │   │   ├── editors.ts      Lenji registar editora sekcija
│   │   │   ├── editors/        Editori po kategoriji sekcije
│   │   │   └── fields/         Deljena polja uređivača
│   │   ├── events/             Šeme, detalji po tipu, čarobnjak
│   │   ├── invitations/        Sklapanje pozivnice od sekcija
│   │   ├── profile/
│   │   ├── sections/           REGISTAR SEKCIJA
│   │   │   ├── types.ts        Ugovor `SectionDefinition`
│   │   │   ├── registry.ts     Lista svih sekcija
│   │   │   ├── migrate.ts      Čitanje, validacija, migracija verzija
│   │   │   ├── shared-schemas.ts
│   │   │   └── definitions/    basics, logistics, media, interaction
│   │   └── themes/             Design tokeni + provera kontrasta
│   ├── i18n/                   Prevodilac, formati, katalozi (4 jezika)
│   ├── lib/                    env, slug, ids, uuid, image-metadata, utils
│   ├── server/
│   │   ├── actions/            Server akcije (jedini put za mutacije)
│   │   ├── adapters/           email · storage · payments
│   │   ├── auth/               Auth.js konfiguracija
│   │   ├── authz/              Dozvole, provere, greške
│   │   ├── db/                 Šema, migracije, seed
│   │   ├── services/           Poslovna logika
│   │   └── rate-limit.ts
│   ├── styles/globals.css      Design tokeni
│   └── proxy.ts                Next 16 „proxy” (bivši middleware)
└── tests/
    ├── unit/                   Šeme, migracije, slug, dozvole, naplata…
    ├── integration/            Rad sa pravom bazom
    └── e2e/                    Playwright scenariji
```

---

## Model baze

36 tabela. Skraćeni ER dijagram glavnih entiteta:

```mermaid
erDiagram
    users ||--o{ events : "poseduje"
    users ||--o{ accounts : ""
    users ||--o{ sessions : ""
    event_types ||--o{ events : "određuje tip"
    events ||--o{ event_collaborators : "deli sa"
    events ||--|| invitations : "ima"
    events ||--o{ guest_households : ""
    events ||--o{ guests : ""
    events ||--o{ seating_plans : ""
    events ||--o{ activity_events : ""

    templates ||--o{ template_versions : "verzije"
    themes ||--o{ template_versions : "tema"
    template_versions ||--o{ invitations : "snimak pri kreiranju"

    invitations ||--o{ invitation_sections : "sadržaj"
    invitations ||--o{ invitation_revisions : "istorija"
    invitations ||--o{ invitation_recipients : "personalizovani linkovi"
    invitations ||--o{ rsvp_questions : "dodatna pitanja"
    invitations ||--o{ rsvp_responses : "odgovori"
    invitations ||--o{ guestbook_entries : ""
    invitations ||--o{ invitation_view_stats : ""

    guest_households ||--o{ guests : "članovi"
    guests ||--o{ guest_preferences : ""
    guests ||--o{ seat_assignments : ""
    rsvp_responses ||--o{ rsvp_answers : ""
    rsvp_questions ||--o{ rsvp_answers : ""

    seating_plans ||--o{ seating_plan_versions : ""
    seating_plan_versions ||--o{ rooms : ""
    rooms ||--o{ tables : ""
    tables ||--o{ seat_assignments : ""

    feature_plans ||--o{ orders : ""
    users ||--o{ orders : ""
    orders ||--o{ payments : ""
    promo_codes ||--o{ orders : ""
```

### Šta je normalizovano, a šta JSONB

| Podatak | Oblik | Zašto |
|---------|-------|-------|
| Sadržaj sekcije | JSONB `invitation_sections.data` | Oblik zavisi od tipa sekcije i menja se sa verzijama |
| Tip, verzija šeme, redosled, vidljivost, ID pozivnice | **zasebne kolone** | Po njima se filtrira i sortira |
| Tokeni teme | JSONB | Uvek se čita ceo objekat, nikad pojedinačno polje |
| Podaci događaja (`details`) | JSONB | Skup polja zavisi od tipa i menja se iz administracije |
| Datum, grad, lokacija | **zasebne kolone** | Pretraga i sortiranje na listi |
| Gosti, domaćinstva, odgovori | normalizovano | Filtriranje, izvoz, agregacija |
| Odgovor na pitanje (`value`) | JSONB | Tip zavisi od tipa pitanja |

### Integritetska pravila

Osim stranih ključeva i `UNIQUE` indeksa, migracija `0001_integrity_rules.sql`
dodaje `CHECK` ograničenja koja poslovna pravila brane i na nivou baze:

- format javnog sluga (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3–60 znakova);
- nenegativan broj odraslih i dece u RSVP odgovoru;
- konzistentnost iznosa narudžbine (`total = subtotal − discount`);
- povraćaj ne može premašiti naplaćeni iznos;
- primalac personalizovanog linka mora biti vezan za gosta ili domaćinstvo;
- `updated_at` trigger na kritičnim tabelama;
- delimični indeksi za aktivne događaje i objavljene pozivnice.

---

## Registar sekcija

Uređivač ne zna ništa o konkretnim tipovima sekcija. Sve dolazi iz registra, pa
dodavanje nove sekcije znači **jednu definiciju i jedan unos u listu** — nijedna
postojeća komponenta se ne menja.

```ts
export type SectionDefinition<TData> = {
  type: string;                 // stabilan ključ, upisuje se u bazu
  version: number;              // verzija šeme podataka
  labelKey: string;             // ključ prevoda, nikad fiksan tekst
  descriptionKey: string;
  icon: string;
  category: SectionCategory;

  schema: ZodType<TData>;       // ista validacija na klijentu i serveru
  getDefaultData: () => TData;

  allowedEventTypes: readonly string[] | null;
  singleton?: boolean;          // sme da postoji samo jednom
  requiresFeature?: string;     // vezano za paket kroz entitlements

  migrate?: (data: unknown, fromVersion: number) => TData;
};
```

**Zašto komponente nisu na definiciji.** Specifikacija predviđa `Editor` i
`Renderer` kao polja definicije. Ovde su namerno izdvojene u zasebne registre
(`features/sections/renderers.ts` i `features/editor/editors.ts`): da su na istom
objektu, uvoz registra na javnoj stranici pozivnice povukao bi i ceo JavaScript
uređivača. Ovako `registry.ts` ostaje bez React-a i može se uvesti bilo gde — na
serveru, u uređivaču i u javnom prikazu. Test
`tests/unit/editor-registry.test.ts` čuva da tri registra ostanu usklađena, pa
sekcija bez editora ne može tiho da se pojavi u biblioteci.

Editori se učitavaju lenjo i **ne renderuju se na serveru**
(`dynamic(loader, { ssr: false })`). Uređivač je privatna stranica iza prijave:
serverski render mu ne donosi ništa, a donosi stvarnu opasnost — kada pregledač
pri hidraciji još nema učitan lenji deo koda, ume da ostane i serverska i
klijentska kopija istog polja u DOM-u.

**Verzionisanje.** Svaka sekcija u bazi pamti `schema_version`. Pri čitanju
`readSectionData` poredi je sa aktuelnom verzijom:

| Situacija | Ponašanje |
|-----------|-----------|
| Verzija se poklapa | Validacija i prikaz |
| Podaci stariji | `migrate()` pa validacija |
| Podaci noviji od koda | Greška, prikazuje se podrazumevani sadržaj |
| Nepoznat tip sekcije | Sekcija se preskače, ostatak pozivnice se prikazuje |
| Neispravni podaci | Sekcija se preskače, greška se loguje |

Oštećena sekcija nikad ne obara celu pozivnicu — gost mora da vidi sadržaj.

Registrovane sekcije: naslovna, imena, datum i vreme, odbrojavanje,
poruka, kalendar, lokacije, satnica, korisne informacije, važne osobe, galerija,
priča, muzika, RSVP, knjiga želja, kontakt, prilagođeni sadržaj, podnožje.

**Custom HTML nije dozvoljen.** Sekcija „prilagođeni sadržaj” nudi naslov,
ograničen bogat tekst (definisana struktura blokova, ne HTML), fotografiju i
jedno dugme sa proverenim linkom. Linkovi prolaze kroz `safeUrlSchema` koji
prihvata isključivo `http:` i `https:`.

---

## Uređivač pozivnice

Uređivač je jedina zaista velika klijentska celina u projektu. Javna stranica
pozivnice je nikad ne uvozi — deli s njom samo model podataka i renderere.

### Dokument kao nepromenljiva vrednost

Sve što uređivač radi svodi se na jedan tip:

```ts
type EditorDocument = {
  theme: ThemeTokens;
  sections: EditorSection[];   // id, type, schemaVersion, position, isVisible, data
};
```

Sve operacije (`addSection`, `moveSection`, `duplicateSection`, `resetSection`,
`applyTemplateToDocument`…) su čiste funkcije koje vraćaju novi dokument. Zbog
toga:

- **poništi/ponovi** je obična istorija vrednosti, bez ijedne inverzne operacije
  koju bi trebalo održavati uz svaku novu radnju;
- **nesačuvane izmene** su poređenje trenutnog i poslednjeg poslatog dokumenta;
- **sve se testira bez DOM-a** — `tests/unit/editor-document.test.ts`.

Uzastopne izmene istog polja u kratkom roku ulaze u **isti** korak istorije, pa
„poništi" vraća celu reč, a ne poslednje otkucano slovo.

### Autosave i sudar dve sesije

Čuvanje kreće kada kucanje stane (1,2 s) i nikad se ne preklapa samo sa sobom.
Detekcija sudara je jedan upit:

```sql
update invitations set revision = revision + 1
where id = $1 and revision = $2   -- revizija koju uređivač misli da ima
```

Ako nijedan red nije pogođen, izmena je zasnovana na zastareloj verziji i vraća
se `ConflictError` sa trenutnom revizijom. Provera pa upis u dva koraka ostavila
bi prozor u kome druga sesija upiše svoje.

Spajanja nema namerno: dva različita teksta u istom polju nemaju tačno rešenje
koje bismo mogli da pogodimo umesto korisnika. Uređivač zato nudi dva jasno
imenovana izlaza — „učitaj tuđu verziju" ili „zadrži moje izmene".

Sekcije se upisuju kao celina unutar transakcije. Identifikatore daje klijent, pa
ostaju stabilni kroz čuvanja i React ključevi se ne pomeraju. Uz svako čuvanje
ide i snimak revizije, ali najviše jedan na pet minuta i najviše dvadeset po
pozivnici — inače bi istorija za sat vremena rada imala hiljade beskorisnih
koraka. Snimak je pogodnost, a ne uslov: sudar u istoriji ne obara čuvanje
sadržaja.

### Pregled je isti kod kao javna pozivnica

`InvitationRenderer` je ista komponenta koju koriste demo šablona, pregled u
uređivaču i (od Faze 4) javna stranica. Razliku pravi samo `context.mode`:
u `preview` režimu su RSVP i knjiga želja prikazani kao onemogućena forma sa
vidljivom napomenom. Pregled zato ne može da obeća nešto što gost neće dobiti.

Pregled radi nad **trenutnim** dokumentom, a ne nad poslednjim sačuvanim — izmena
se vidi dok se kuca. Prikaz za telefon i tablet koristi
`container-type: inline-size`, pa se pozivnica prilagođava širini okvira umesto
širini prozora.

### Jedno stablo za sve širine ekrana

Na širokom ekranu stoje tri kolone, na telefonu isti paneli postaju tabovi.
Renderuje se **jedno** stablo, a raspored menja samo CSS. Dva stabla sa `hidden`
klasom značila bi dve kopije svakog polja u DOM-u, dvostruki posao pri svakom
pritisku tastera i dve kontrole sa istim nazivom za čitač ekrana. `display: none`
uklanja panel i sa ekrana i iz stabla pristupačnosti u istom trenutku.

### Pristupačnost promene redosleda

Prevlačenje (dnd-kit) je udobno mišem, ali nije jedini način. Svaka sekcija ima
„pomeri gore" i „pomeri dole" u meniju, tastaturni senzor radi razmaknicom i
strelicama, a svaka promena redosleda se izgovara kroz `aria-live` područje sa
novom pozicijom i ukupnim brojem sekcija.

### Provera kontrasta uživo

Paleta je jedino slobodno polje teme, pa se uz nju računa WCAG odnos kontrasta
za sve bitne parove boja pri svakoj izmeni. Upozorenje stoji odmah ispod palete,
ne iza „naprednih podešavanja": ako je pozivnica nečitljiva, to je prvo što
korisnik treba da vidi.

### Promena šablona bez gubitka sadržaja

Pravilo je jednostavno: **šablon donosi raspored i izgled, korisnik zadržava
sadržaj.** Za svaki tip sekcije koji postoji i u dokumentu i u šablonu preuzimaju
se korisnikovi podaci; prazne sekcije ustupaju mesto šablonskim; sekcije koje je
korisnik popunio, a šablon ih nema, premeštaju se na kraj umesto da nestanu.

---

## Tok kreiranja i objavljivanja

```mermaid
flowchart TD
    A[Posetilac otvara početnu] --> B[Bira vrstu proslave]
    B --> C[Unosi osnovne podatke]
    C --> D{Prijavljen?}
    D -- ne --> E[Magic link prijava]
    E --> F
    D -- da --> F[Nacrt: događaj + pozivnica + rezervisan slug]

    F --> G[Uređivač: sekcije, tema, fotografije]
    G --> H[Autosave uz broj revizije]
    H --> G
    G --> I[Pregled kao gost]

    I --> J{Objaviti?}
    J -- ne --> G
    J -- da --> K[Narudžbina: pending]
    K --> L[Payment adapter: intent]
    L --> M{Webhook / potvrda}
    M -- neuspeh --> N[Ostaje nacrt, link neaktivan]
    N --> G
    M -- uspeh --> O[Narudžbina: paid]
    O --> P[Pozivnica objavljena, javni link aktivan]

    P --> Q[Deljenje: Viber, WhatsApp, SMS, email, QR]
    Q --> R[Gost otvara /p/slug]
    R --> S[Gost potvrđuje dolazak bez naloga]
    S --> T[Organizator vidi statistiku i raspoređuje goste]

    P --> U[Izmena sadržaja posle objave]
    U --> P

    style P fill:#e8f5e9
    style N fill:#ffebee
```

Link se rezerviše u trenutku kreiranja nacrta i **ne menja se** kasnijim izmenama
sadržaja. Promena sluga je zasebna, kontrolisana operacija
(`changeInvitationSlug`) sa proverom formata, rezervisanih reči i zauzetosti.

---

## Adapteri

Svaka spoljna integracija je iza interfejsa, sa implementacijom koja radi bez
ijednog API ključa.

### Email — `src/server/adapters/email`

| Drajver | Ponašanje |
|---------|-----------|
| `console` (podrazumevano) | Ispisuje poruku u terminal, izdvaja linkove. Ne šalje ništa. |
| `resend` | Šalje preko Resend HTTP API-ja. Zahteva `RESEND_API_KEY`. |

Šabloni: magic link, dobrodošlica, poziv saradniku. Svi su lokalizovani i uvek
nose i tekstualnu verziju uz HTML.

### Storage — `src/server/adapters/storage`

| Drajver | Ponašanje |
|---------|-----------|
| `local` (podrazumevano) | Piše u `public/uploads`. Klijent i ovde traži **potpisan** URL sa rokom trajanja, pa lokalna ruta nije otvoreni upload endpoint. |
| `s3` | Bilo koji S3-kompatibilan servis. Presigned `PUT` preko SigV4 (`node:crypto`, bez AWS SDK-a). |

Validacija (`validateUpload`) proverava MIME tip i veličinu **pre** izdavanja
URL-a; primaju se JPEG, PNG i WebP do 12 MB. Lokalni adapter dodatno odbija
ključeve koji bi izašli iz `public/uploads`.

**Uklanjanje metapodataka (zahtev 24).** Fotografija sa telefona nosi EXIF blok
sa tačnom GPS lokacijom snimanja; objavljena pozivnica ne sme da oda adresu stana.
Odbrana ide u tri koraka:

1. **Uređivač prekodira sliku** pre slanja: dekodira je uz primenu EXIF
   orijentacije, crta u `canvas` i kodira u WebP. Rezultat po konstrukciji nema
   metapodatke, jer canvas nema gde da ih zapiše. Usput se slika smanjuje na
   2400 px, što je i pitanje performansi javne stranice.
2. **Server ih uklanja još jednom** kada fajl prolazi kroz aplikaciju (lokalni
   drajver): `src/lib/image-metadata.ts` je scrubber bez zavisnosti koji iz
   JPEG-a baca `APP1` (EXIF/XMP), `APP13` (IPTC) i komentare — a zadržava `APP0`
   i ICC profil boja — iz PNG-a `eXIf` i tekstualne komade, a iz WebP-a delove
   `EXIF` i `XMP ` uz gašenje odgovarajućih zastavica u `VP8X` zaglavlju.
3. **Server proverava rezultat.** Uz S3 fajl ide iz pregledača pravo u skladište,
   pa server pri potvrdi pročita prvih 64 KB (`readHead`) i sam utvrdi da
   metapodataka nema. Ako ih ima, fotografija se briše iz skladišta i ne ulazi u
   pozivnicu. Klijentska obrada nikad nije odbrana — ovo jeste.

AVIF i HEIC se ne primaju baš zato što iz njih ne umemo pouzdano da uklonimo
EXIF. Korisnik to ne oseti, jer uređivač svaku fotografiju ionako prekodira u
WebP.

### Naplata — `src/server/adapters/payments`

| Drajver | U produkciji | Ponašanje |
|---------|--------------|-----------|
| `dev` | **Ne** | Nalog ostaje `pending`; administrator ga ručno označava kao plaćen. |
| `manual` | Da | Uplatnica / bankovni transfer / IPS QR; potvrda se evidentira ručno. |

`getPaymentAdapter()` baca grešku ako je u produkciji izabran provajder sa
`allowedInProduction = false`. Objavljivanje tada ne radi — što je namerno bolje
nego da korisnik vidi lažnu potvrdu uplate.

Prelazi stanja su na jednom mestu (`canTransition`) i pokriveni testovima;
`succeeded → pending` se odbija jer webhookovi stižu van redosleda i ponavljaju
se. Idempotencija se čuva na dva nivoa: `orders.idempotency_key` (UNIQUE) i
tabela `webhook_events` (UNIQUE po provajderu i ID-ju događaja).

---

## Environment varijable

Kompletna lista sa objašnjenjima je u [`.env.example`](./.env.example).
Obavezno u produkciji:

| Varijabla | Napomena |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL konekcija |
| `AUTH_SECRET` | Najmanje 32 znaka (`openssl rand -base64 32`) |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Javni URL aplikacije |
| `AUTH_TRUST_HOST` | `true` iza reverse proxy-ja |

Validacija je u `src/lib/env.ts` (Zod) i lenja je — `next build` prolazi i bez
produkcijskih tajni, ali svaka runtime upotreba dobija proverenu vrednost.
Produkcijski režim dodatno zahteva `RESEND_API_KEY` kada je `EMAIL_DRIVER=resend`
i S3 podatke kada je `STORAGE_DRIVER=s3`.

---

## Komande

```bash
# Razvoj
pnpm dev                 # razvojni server
pnpm build               # produkcijski build
pnpm start               # pokretanje build-a

# Kvalitet
pnpm lint                # ESLint
pnpm lint:fix
pnpm typecheck           # tsc --noEmit
pnpm check               # lint + typecheck + unit testovi

# Baza
pnpm db:up               # Docker: PostgreSQL + MinIO
pnpm db:down
pnpm db:generate         # generisanje migracije iz šeme
pnpm db:migrate          # primena migracija
pnpm db:seed             # demo podaci (idempotentno)
pnpm db:reset            # brisanje svih podataka (šema ostaje)
pnpm db:studio           # Drizzle Studio

# Testovi
pnpm test                # unit
pnpm test:watch
pnpm test:integration    # zahteva TEST_DATABASE_URL
pnpm test:all
pnpm test:e2e            # Playwright
```

---

## Testiranje

| Vrsta | Broj | Pokriva |
|-------|------|---------|
| Unit | 214 | Zod šeme sekcija, migracije verzija, slug, tokeni, dozvole, entitlements, prelazi stanja naplate, kontrast tema, i18n i množina, registri sekcija/renderera/editora, tokeni teme u CSS, grupisanje boja, demo kontekst, seed šabloni, **operacije nad dokumentom uređivača**, **istorija poništi/ponovi**, **spajanje pri promeni šablona**, **uklanjanje EXIF-a iz JPEG/PNG/WebP** |
| Integracioni | 54 | Kreiranje događaja u transakciji, jedinstvenost sluga, limiti paketa, meko brisanje, cascade pravila, `CHECK` ograničenja, snimak verzije šablona, **čuvanje nacrta i sudar revizija**, **limiti i zaključane sekcije pri čuvanju**, **snimci verzija i njihovo orezivanje**, **otpremanje fotografija i odbijanje fajla sa EXIF-om** |
| E2E | 74 (37 × desktop/mobilni) | Marketing, prijava, zaštita ruta, čarobnjak sa izborom šablona, dashboard, izmena bez promene linka, brisanje uz potvrdu, profil, galerija i filteri, favoriti, demo na tri veličine ekrana, cenovnik, česta pitanja, sitemap, **uređivač: izmena teksta uz živi pregled i autosave, biblioteka sekcija, zaključana sekcija, promena redosleda bez miša, sakrivanje sekcije, upozorenje o kontrastu, otpremanje fotografije** |

```bash
pnpm test                # unit — bez baze

# Integracioni testovi traže zasebnu bazu:
createdb pozivnica_test
DATABASE_URL="postgresql://pozivnica:pozivnica@localhost:5432/pozivnica_test" pnpm db:migrate
pnpm test:integration

# E2E — sam gradi i pokreće aplikaciju:
pnpm exec playwright install chromium
pnpm test:e2e
```

Ako je Chromium već instaliran sistemski, a verzija se ne poklapa sa onom koju
Playwright očekuje, postavi `PLAYWRIGHT_CHROMIUM_PATH` na putanju do binarnog
fajla.

Integracioni testovi se **preskaču** ako `TEST_DATABASE_URL` nije postavljen, pa
`pnpm test:all` radi i na mašini bez baze.

---

## Bezbednost

Implementirano do kraja Faze 3:

- **Autorizacija na serveru** za svaku akciju i stranicu; interfejs nikad nije
  jedina odbrana.
- **Zaštita od IDOR-a** — tuđi resurs vraća 404, ne 403.
- **Dozvole po ulogama** (`owner`, `editor`, `guest_manager`, `viewer`) sa
  radnjama rezervisanim isključivo za vlasnika (brisanje, objavljivanje, naplata,
  saradnici).
- **Zod validacija na obe strane**; server nikad ne veruje klijentu.
- **Rate limiting** na magic link (po IP i po email adresi) i na kreiranje
  događaja.
- **Kriptografski nepredvidivi tokeni** (`crypto.randomBytes`, Crockford base32),
  čuvani isključivo kao SHA-256 heš.
- **Otvoreno preusmerenje sprečeno** — `callbackUrl` prihvata samo relativne
  putanje.
- **Bez proizvoljnog HTML-a**; linkovi ograničeni na `http`/`https`. Sekcija
  „prilagođeni sadržaj" nudi blokove teksta koje sami renderujemo, pa u trenutku
  prikaza nema šta da se sanitizuje.
- **Bezbedni upload URL-ovi** sa proverom MIME tipa, veličine i putanje, uz
  **uklanjanje EXIF lokacije** iz svake fotografije i serversku proveru da je
  zaista uklonjena (vidi [Adapteri](#adapteri)).
- **Limiti paketa i zaključane sekcije proveravaju se pri čuvanju**, ne samo u
  biblioteci sekcija: zahtev koji zaobiđe interfejs biva odbijen.
- **Optimističko zaključavanje** pri čuvanju nacrta — istovremena izmena iz dve
  sesije se prijavljuje umesto da se tiho prepiše.
- **CSRF** — mutacije idu isključivo kroz server akcije, koje imaju ugrađenu
  zaštitu; odjava radi i bez JavaScripta.
- **Sigurnosna zaglavlja** i `X-Robots-Tag: noindex` na `/p/*`.
- **Provera potpisa webhooka** i idempotentna obrada uplata.
- **Audit log** za administrativne radnje.

---

## Deployment

Projekat je Vercel-kompatibilan. Potrebno je:

1. PostgreSQL 16 (Neon, Supabase, RDS…) i `DATABASE_URL`.
2. `AUTH_SECRET`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_TRUST_HOST=true`.
3. `EMAIL_DRIVER=resend` + `RESEND_API_KEY` i verifikovan domen pošiljaoca.
4. `STORAGE_DRIVER=s3` + S3 podaci i `S3_PUBLIC_URL` sa koga se serviraju
   fotografije. `NEXT_PUBLIC_MEDIA_HOSTS` treba postaviti samo ako se negde
   koristi `next/image`; sekcije pozivnice namerno koriste običan `<img>` da
   novi storage host ne bi tražio izmenu `next.config.ts`.
5. `PAYMENT_DRIVER` postaviti na provajdera dozvoljenog u produkciji.
6. Migracije pokrenuti pre puštanja saobraćaja: `pnpm db:migrate`.

Seed nije namenjen produkciji — puni bazu demo sadržajem.

---

## Poznata ograničenja

Iskreni pregled onoga što **još ne postoji** na kraju Faze 3. Detaljan plan je u
[`TASKS.md`](./TASKS.md).

| Oblast | Stanje |
|--------|--------|
| Javna pozivnica `/p/[slug]` | Renderer radi (demo stranice i pregled u uređivaču); nedostaju privatnost, keširanje, deljenje i QR — Faza 4 |
| RSVP i knjiga želja | Podešavaju se u uređivaču i u pregledu izgledaju tačno kao gostu, ali su isključene i označene; obrada odgovora u Fazi 5 |
| Muzička sekcija | Podešavanja i prikaz rade; biblioteka numera još nije popunjena, a otpremanje zvuka dolazi u Fazi 8 |
| EXIF uz S3 skladište | Uređivač uklanja metapodatke, server proverava prvih 64 KB fajla. Zaostali tekstualni komad na kraju velikog PNG-a bi promakao toj proveri; lokalni drajver obrađuje ceo fajl |
| AVIF i HEIC | Ne primaju se pri otpremanju jer iz njih ne umemo pouzdano da uklonimo EXIF; uređivač ih prekodira u WebP, pa korisnik to ne oseti |
| Istorija verzija | Poslednjih 20 snimaka, najviše jedan na pet minuta; vraćanje ide kao obična izmena koju „poništi" može da vrati |
| Sudar dve sesije | Ne spaja se automatski — korisnik bira da učita tuđu verziju ili da zadrži svoju |
| Pravni dokumenti | Radna verzija napisana prema stvarnom ponašanju aplikacije; traži pregled pravnika, i stranica to kaže |
| Gosti i RSVP interfejs | Kompletan model i dozvole; interfejs u Fazi 5 |
| Raspored sedenja | Model, kapaciteti i preferencije u bazi; editor u Fazi 6 |
| Naplata | Adapter, prelazi stanja i idempotencija testirani; tok objavljivanja u Fazi 7 |
| Admin panel | Uloga i audit log postoje; stranice u Fazi 7 |
| Rate limiting | In-memory, po instanci procesa. Za više instanci potreban Redis — interfejs je izdvojen |
| Preuzimanje/brisanje podataka | Najavljeno u interfejsu, obrađuje se ručno do Faze 8 |
| Saradnici | Model, pozivnice i dozvole u bazi; tok prihvatanja poziva u Fazi 7 |

Nijedan ekran ne prikazuje dugme koje ne radi. Tamo gde funkcionalnost još ne
postoji, interfejs to jasno kaže.
