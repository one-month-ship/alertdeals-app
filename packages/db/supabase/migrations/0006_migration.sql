ALTER TABLE "ads" ADD COLUMN "repost_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "sold_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ads_sold_at_idx" ON "ads" USING btree ("sold_at");--> statement-breakpoint
ALTER TABLE "ads" DROP COLUMN "has_been_reposted";