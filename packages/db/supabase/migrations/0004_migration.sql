CREATE TYPE "public"."alert_mode" AS ENUM('price_max', 'margin_min');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(255),
	"status" "alert_status" DEFAULT 'active' NOT NULL,
	"brand_id" smallint,
	"model_id" smallint,
	"location_id" integer,
	"radius_in_km" smallint,
	"model_year_min" smallint,
	"model_year_max" smallint,
	"mileage_min" integer,
	"mileage_max" integer,
	"price_min" real,
	"mode" "alert_mode" NOT NULL,
	"price_max" real,
	"margin_min_percentage" real,
	"notification_channels" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alert_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_account_id_idx" ON "alerts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "alert_account_id_status_idx" ON "alerts" USING btree ("account_id","status");--> statement-breakpoint
CREATE POLICY "enable insert for authenticated roles" ON "alerts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "enable read update and delete for the alert owners" ON "alerts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("alerts"."account_id" = (select auth.uid())) WITH CHECK ("alerts"."account_id" = (select auth.uid()));