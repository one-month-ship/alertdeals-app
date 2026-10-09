CREATE TYPE "public"."ad_owner_type" AS ENUM('private', 'pro');--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "owner_type" "ad_owner_type";--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "owner_type" "ad_owner_type";--> statement-breakpoint
CREATE INDEX "ads_owner_type_idx" ON "ads" USING btree ("owner_type");