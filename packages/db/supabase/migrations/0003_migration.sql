CREATE TYPE "public"."alert_mode" AS ENUM('price_max', 'margin_min');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"has_subscription" boolean DEFAULT false NOT NULL,
	"confirmed_by_admin" boolean DEFAULT false NOT NULL,
	"is_first_connexion" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ad_sub_types" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"ad_type_id" smallint NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "unique_subtype" UNIQUE("ad_type_id","name")
);
--> statement-breakpoint
ALTER TABLE "ad_sub_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ad_types" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "ad_type_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ad_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type_id" smallint NOT NULL,
	"subtype_id" smallint,
	"driving_licence_id" smallint,
	"gear_box_id" smallint,
	"vehicle_seats_id" smallint,
	"vehicle_state_id" smallint,
	"location_id" integer NOT NULL,
	"brand_id" integer,
	"model_id" smallint,
	"market_position_id" smallint,
	"fuel_id" smallint,
	"url" text NOT NULL,
	"original_ad_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"picture" text,
	"pictures" text[],
	"price" double precision NOT NULL,
	"has_been_reposted" boolean DEFAULT false NOT NULL,
	"has_been_boosted" boolean DEFAULT false NOT NULL,
	"is_urgent" boolean DEFAULT false NOT NULL,
	"model_year" smallint,
	"initial_publication_date" date NOT NULL,
	"last_publication_date" date NOT NULL,
	"mileage" real,
	"created_at" date DEFAULT now(),
	"price_has_dropped" boolean DEFAULT false NOT NULL,
	"price_min" real,
	"price_max" real,
	"margin_amount_min" real,
	"margin_amount_max" real,
	"margin_percentage_min" real,
	"margin_percentage_max" real,
	"is_low_price" boolean DEFAULT false NOT NULL,
	"phone_number" text,
	"owner_name" text NOT NULL,
	"entry_year" smallint,
	"has_phone" boolean DEFAULT false NOT NULL,
	"equipments" text,
	"other_specifications" text,
	"technical_inspection_year" smallint,
	"good_deal_name" text,
	CONSTRAINT "ads_original_ad_id_unique" UNIQUE("original_ad_id")
);
--> statement-breakpoint
ALTER TABLE "ads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brands" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "brand_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "driving_licences" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "driving_licence_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "driving_licences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fuels" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "fuel_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "fuels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "gear_boxes" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "gear_box_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "gear_boxes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"zipcode" varchar(5) NOT NULL,
	"name" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	CONSTRAINT "zipcode_name_unique" UNIQUE("name","zipcode")
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "market_positions" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text
);
--> statement-breakpoint
ALTER TABLE "market_positions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_models" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"brand_id" smallint NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "vehicle_model_brand_name_unique" UNIQUE("brand_id","name")
);
--> statement-breakpoint
ALTER TABLE "vehicle_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_seats" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "vehicle_seats_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "vehicle_seats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "vehicle_states" (
	"id" "smallserial" PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lbc_value" text,
	"lobstr_value" text,
	CONSTRAINT "vehicle_state_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "vehicle_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "ad_sub_types" ADD CONSTRAINT "ad_sub_types_ad_type_id_ad_types_id_fk" FOREIGN KEY ("ad_type_id") REFERENCES "public"."ad_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_type_id_ad_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."ad_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_subtype_id_ad_sub_types_id_fk" FOREIGN KEY ("subtype_id") REFERENCES "public"."ad_sub_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_driving_licence_id_driving_licences_id_fk" FOREIGN KEY ("driving_licence_id") REFERENCES "public"."driving_licences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_gear_box_id_gear_boxes_id_fk" FOREIGN KEY ("gear_box_id") REFERENCES "public"."gear_boxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_vehicle_seats_id_vehicle_seats_id_fk" FOREIGN KEY ("vehicle_seats_id") REFERENCES "public"."vehicle_seats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_vehicle_state_id_vehicle_states_id_fk" FOREIGN KEY ("vehicle_state_id") REFERENCES "public"."vehicle_states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_market_position_id_market_positions_id_fk" FOREIGN KEY ("market_position_id") REFERENCES "public"."market_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_fuel_id_fuels_id_fk" FOREIGN KEY ("fuel_id") REFERENCES "public"."fuels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_model_id_vehicle_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."vehicle_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alert_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ads_brand_id_idx" ON "ads" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "ads_model_id_idx" ON "ads" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "ads_vehicle_state_id_idx" ON "ads" USING btree ("vehicle_state_id");--> statement-breakpoint
CREATE INDEX "ads_type_id_idx" ON "ads" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "ads_subtype_id_idx" ON "ads" USING btree ("subtype_id");--> statement-breakpoint
CREATE INDEX "ads_location_id_idx" ON "ads" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "ads_has_phone_idx" ON "ads" USING btree ("has_phone");--> statement-breakpoint
CREATE INDEX "ads_created_at_idx" ON "ads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ads_price_idx" ON "ads" USING btree ("price");--> statement-breakpoint
CREATE INDEX "ads_price_min_idx" ON "ads" USING btree ("price_min");--> statement-breakpoint
CREATE INDEX "ads_price_max_idx" ON "ads" USING btree ("price_max");--> statement-breakpoint
CREATE INDEX "ads_title_idx" ON "ads" USING btree ("title");--> statement-breakpoint
CREATE INDEX "ads_margin_amount_min" ON "ads" USING btree ("margin_amount_min");--> statement-breakpoint
CREATE INDEX "ads_margin_amount_max" ON "ads" USING btree ("margin_amount_max");--> statement-breakpoint
CREATE INDEX "ads_margin_percent_min" ON "ads" USING btree ("margin_percentage_min");--> statement-breakpoint
CREATE INDEX "ads_margin_percent_max" ON "ads" USING btree ("margin_percentage_max");--> statement-breakpoint
CREATE INDEX "locations_geo_idx" ON "locations" USING gist ((extensions.ST_MakePoint("lng", "lat")::extensions.geography));--> statement-breakpoint
CREATE INDEX "alert_account_id_idx" ON "alerts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "alert_account_id_status_idx" ON "alerts" USING btree ("account_id","status");--> statement-breakpoint
CREATE POLICY "enable all for account owners" ON "accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "accounts"."id") WITH CHECK ((select auth.uid()) = "accounts"."id");--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "ad_sub_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "ad_types" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Enable read access for authenticated users" ON "ads" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "brands" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "driving_licences" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "fuels" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "gear_boxes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "locations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "market_positions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "vehicle_models" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "vehicle_seats" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable read for authenticated users" ON "vehicle_states" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "enable insert for authenticated roles" ON "alerts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "enable read update and delete for the alert owners" ON "alerts" AS PERMISSIVE FOR ALL TO "authenticated" USING ("alerts"."account_id" = (select auth.uid())) WITH CHECK ("alerts"."account_id" = (select auth.uid()));