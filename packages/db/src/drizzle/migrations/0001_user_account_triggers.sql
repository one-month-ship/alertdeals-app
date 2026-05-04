-- Create personal account for new auth users.
-- Mirrors the auth.users id 1:1 into public.accounts so every authenticated
-- user has a row to attach app data to. Defaults handle has_subscription=false,
-- confirmed_by_admin=false, is_first_connexion=true.
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
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created_account ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created_account
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account();
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_updated_account ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_updated_account
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_account();
--> statement-breakpoint

-- Cascade delete the public.accounts row when the auth.users row disappears.
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
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_deleted_account ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_deleted_account
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();
