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
CREATE POLICY "enable all for account owners" ON "accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "accounts"."id") WITH CHECK ((select auth.uid()) = "accounts"."id");