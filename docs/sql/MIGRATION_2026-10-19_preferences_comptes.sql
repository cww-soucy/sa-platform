-- 2026-10-19 — Réglages d'affichage propres à chaque compte (sa-admin › Monitoring : employés affichés, filtres,
-- tris, salles suivies). Une ligne par compte et par écran : id = '<uid>:<cle>' (ex. 'cwweil:monitoring').
-- `appareil` / `appareil_nom` : dernier appareil qui a enregistré — sert à demander, sur un nouvel appareil,
-- s'il faut garder les réglages du compte ou en faire de propres à cet appareil.
-- Additif : aucune donnée existante n'est modifiée. Même niveau d'accès que les autres tables partagées (clé publique).
create table if not exists public.preferences_comptes (
  id text primary key,
  uid text not null,
  cle text not null,
  valeur jsonb not null default '{}'::jsonb,
  appareil text,
  appareil_nom text,
  updated_at timestamptz not null default now()
);
create index if not exists preferences_comptes_uid on public.preferences_comptes(uid);
alter table public.preferences_comptes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='preferences_comptes' and policyname='prefc_select') then
    create policy prefc_select on public.preferences_comptes for select to anon using (true);
    create policy prefc_insert on public.preferences_comptes for insert to anon with check (true);
    create policy prefc_update on public.preferences_comptes for update to anon using (true) with check (true);
  end if;
end $$;
grant select, insert, update on public.preferences_comptes to anon;
notify pgrst, 'reload schema';
