CREATE TYPE "public"."ad_risk_level" AS ENUM('none', 'minor', 'major', 'administrative');--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "description_risk_level" "ad_risk_level";--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "description_risk_reason" text;--> statement-breakpoint
CREATE INDEX "ads_description_risk_level_idx" ON "ads" USING btree ("description_risk_level");