-- Solo para tests locales: lo mínimo de Supabase que usa la migración.
-- En Supabase real todo esto ya existe.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, created_at timestamptz not null default now());
-- Supabase da a anon/authenticated permisos amplios en public por defecto: lo imitamos
-- para que el test de seguridad pruebe que la migración los saca.
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
