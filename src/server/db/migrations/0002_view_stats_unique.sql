-- Dnevni agregat pregleda: jedan red po pozivnici i danu.
--
-- Brojač se uvećava kroz `insert ... on conflict do update`, pa jedinstvenost
-- para (pozivnica, dan) nije optimizacija nego uslov ispravnosti: bez nje dva
-- istovremena pregleda ne bi mogla bezbedno da se sabiraju.

--> statement-breakpoint
DROP INDEX "invitation_view_stats_invitation_day_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "invitation_view_stats_day_unique" ON "invitation_view_stats" USING btree ("invitation_id","day");