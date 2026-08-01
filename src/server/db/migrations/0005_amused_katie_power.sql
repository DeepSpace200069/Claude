CREATE TYPE "public"."template_kind" AS ENUM('sections', 'html');--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "html_document" text;--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "field_definitions" jsonb;--> statement-breakpoint
ALTER TABLE "template_versions" ADD COLUMN "assets" jsonb;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "kind" "template_kind" DEFAULT 'sections' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation_revisions" ADD COLUMN "field_values" jsonb;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "field_definitions" jsonb;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "field_values" jsonb;