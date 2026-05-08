-- Accounts table: mirrors auth.users 1:1 with app-specific flags.
CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" varchar(320) NOT NULL,
  "has_subscription" boolean DEFAULT false NOT NULL,
  "confirmed_by_admin" boolean DEFAULT false NOT NULL,
  "is_first_connexion" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enable all for account owners" ON "accounts"
  AS PERMISSIVE FOR ALL TO "authenticated"
  USING ((select auth.uid()) = "accounts"."id")
  WITH CHECK ((select auth.uid()) = "accounts"."id");

-- Sync trigger: create / update public.accounts row whenever auth.users changes.
CREATE OR REPLACE FUNCTION public.handle_new_user_account()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
begin
  insert into public.accounts (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created_account ON auth.users;
CREATE TRIGGER on_auth_user_created_account
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account();

DROP TRIGGER IF EXISTS on_auth_user_updated_account ON auth.users;
CREATE TRIGGER on_auth_user_updated_account
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account();

-- Cascade delete: remove public.accounts row when auth.users row disappears.
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
begin
  delete from public.accounts where id = old.id;
  return old;
end;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_deleted_account ON auth.users;
CREATE TRIGGER on_auth_user_deleted_account
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();
