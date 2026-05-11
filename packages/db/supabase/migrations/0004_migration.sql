ALTER TABLE "ads" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "market_median_price" real;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "market_price" real;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "margin_amount" real;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "margin_percentage" real;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "is_whatsapp_phone" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "is_mobile_phone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "accept_salesmen" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "ads_margin_percentage_idx" ON "ads" USING btree ("margin_percentage");--> statement-breakpoint
CREATE INDEX "ads_fuel_id_idx" ON "ads" USING btree ("fuel_id");--> statement-breakpoint
CREATE INDEX "ads_model_year_idx" ON "ads" USING btree ("model_year");--> statement-breakpoint
CREATE INDEX "ads_last_publication_date_idx" ON "ads" USING btree ("last_publication_date");