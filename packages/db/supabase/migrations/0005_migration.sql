CREATE TABLE "ad_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"price" real NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_price_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_price_history" ADD CONSTRAINT "ad_price_history_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_price_history_ad_recorded_idx" ON "ad_price_history" USING btree ("ad_id","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "ad_price_history" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);