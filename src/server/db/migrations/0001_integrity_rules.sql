-- Ručno pisana migracija: integritetska pravila koja Drizzle šema ne može da izrazi.
--
-- 1. Kružni strani ključevi (šablon <-> verzija šablona, plan <-> verzija plana).
--    Ne mogu se deklarisati u TypeScript šemi bez cirkularnog importa, pa se
--    dodaju ovde kao DEFERRABLE - obe strane se upisuju u istoj transakciji.
-- 2. CHECK ograničenja koja štite poslovna pravila na nivou baze.
-- 3. Trigger za `updated_at` da vrednost bude tačna i pri direktnom SQL upisu.

--> statement-breakpoint
ALTER TABLE "templates"
  ADD CONSTRAINT "templates_published_version_fk"
  FOREIGN KEY ("published_version_id") REFERENCES "template_versions"("id")
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

--> statement-breakpoint
ALTER TABLE "seating_plans"
  ADD CONSTRAINT "seating_plans_active_version_fk"
  FOREIGN KEY ("active_version_id") REFERENCES "seating_plan_versions"("id")
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

--> statement-breakpoint
-- Slug javne pozivnice: samo ASCII mala slova, cifre i crtica (zahtev 21).
ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_public_slug_format"
  CHECK ("public_slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length("public_slug") BETWEEN 3 AND 60);

--> statement-breakpoint
-- Broj gostiju u odgovoru ne može biti negativan.
ALTER TABLE "rsvp_responses"
  ADD CONSTRAINT "rsvp_responses_counts_non_negative"
  CHECK ("adults_count" >= 0 AND "children_count" >= 0);

--> statement-breakpoint
-- Kapacitet stola mora biti pozitivan; zone bez sedišta koriste shape='zone'.
ALTER TABLE "tables"
  ADD CONSTRAINT "tables_capacity_positive"
  CHECK ("capacity" >= 0 AND "capacity" <= 100);

--> statement-breakpoint
-- Iznosi narudžbine moraju biti konzistentni i nenegativni (zahtev 17).
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_amounts_valid"
  CHECK (
    "subtotal_minor" >= 0
    AND "discount_minor" >= 0
    AND "total_minor" >= 0
    AND "total_minor" = "subtotal_minor" - "discount_minor"
  );

--> statement-breakpoint
-- Povraćaj ne može premašiti naplaćeni iznos.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_refund_within_amount"
  CHECK ("refunded_amount_minor" >= 0 AND "refunded_amount_minor" <= "amount_minor");

--> statement-breakpoint
-- Redosled sekcija je nenegativan; jedinstvenost pozicije se održava u servisu
-- jer se pri promeni redosleda pozicije privremeno preklapaju.
ALTER TABLE "invitation_sections"
  ADD CONSTRAINT "invitation_sections_position_non_negative"
  CHECK ("position" >= 0);

--> statement-breakpoint
-- Primalac mora biti vezan ili za domaćinstvo ili za pojedinačnog gosta.
ALTER TABLE "invitation_recipients"
  ADD CONSTRAINT "invitation_recipients_target_present"
  CHECK ("household_id" IS NOT NULL OR "guest_id" IS NOT NULL);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'users', 'events', 'invitations', 'invitation_sections', 'guests',
    'guest_households', 'rsvp_responses', 'orders', 'payments', 'templates',
    'template_versions', 'tables', 'seat_assignments'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      target, target
    );
  END LOOP;
END;
$$;

--> statement-breakpoint
-- Delimični indeks: aktivni (neobrisani) događaji su ono što dashboard čita.
CREATE INDEX "events_owner_active_idx" ON "events" ("owner_id", "created_at" DESC)
  WHERE "deleted_at" IS NULL;

--> statement-breakpoint
-- Objavljene pozivnice se traže po slugu na svakom otvaranju javnog linka.
CREATE INDEX "invitations_published_slug_idx" ON "invitations" ("public_slug")
  WHERE "status" = 'published' AND "deleted_at" IS NULL;
