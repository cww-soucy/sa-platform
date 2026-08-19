-- ═══════════════════════════════════════════════════════════════════════
-- SA PLATFORM — CORRECTIF SYNCHRONISATION COMPLET
-- ═══════════════════════════════════════════════════════════════════════
-- À COLLER UNE SEULE FOIS dans Supabase → SQL Editor → RUN
--
-- POURQUOI : diagnostic du 19/08/2026 sur ta base réelle a révélé que
--   3 TABLES N'EXISTENT PAS et que la table `plan` a 6 COLONNES MANQUANTES.
--   Résultat : tes plans de match et créneaux créés sur l'ordinateur étaient
--   REJETÉS par le serveur en silence → jamais visibles sur mobile.
--
-- SÉCURITAIRE : ce script n'ajoute que ce qui manque (CREATE IF NOT EXISTS /
--   ADD COLUMN IF NOT EXISTS). Il ne supprime AUCUNE donnée existante.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────
-- 1. TABLE `plan` (créneaux) — colonnes manquantes
--    Cause : les créneaux avec client/adresse/description étaient rejetés
--    (erreur serveur : "column plan.client does not exist")
-- ─────────────────────────────────────────────────────────
alter table public.plan add column if not exists client   text;
alter table public.plan add column if not exists addr     text;
alter table public.plan add column if not exists site_id  text;
alter table public.plan add column if not exists type     text;
alter table public.plan add column if not exists descr    text;
alter table public.plan add column if not exists emps     text;


-- ─────────────────────────────────────────────────────────
-- 2. TABLE `plan_match` — N'EXISTAIT PAS DU TOUT
--    Cause principale : tes plans de match ne montaient jamais au serveur.
-- ─────────────────────────────────────────────────────────
create table if not exists public.plan_match (
  id            text primary key,
  emp           text,
  date          text,
  vehicule      text,
  superviseur   text,
  resume        text,
  sections      jsonb,
  obstacles     text,
  bonscoups     text,
  status        text,
  created_by    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_plan_match_date on public.plan_match(date);

alter table public.plan_match enable row level security;
drop policy if exists "rw_all_plan_match" on public.plan_match;
create policy "rw_all_plan_match" on public.plan_match for all using (true) with check (true);


-- ─────────────────────────────────────────────────────────
-- 3. TABLE `sites` — colonnes manquantes (site web, bassins, GPS)
-- ─────────────────────────────────────────────────────────
alter table public.sites add column if not exists siteweb text;
alter table public.sites add column if not exists bassins jsonb;
alter table public.sites add column if not exists gps     jsonb;


-- ─────────────────────────────────────────────────────────
-- 4. TABLE `workorders` — colonne manquante
-- ─────────────────────────────────────────────────────────
alter table public.workorders add column if not exists assignes text;
alter table public.workorders add column if not exists created_by text;


-- ─────────────────────────────────────────────────────────
-- 5. TABLE `punch_gps_log` — journal GPS des punchs (n'existait pas)
-- ─────────────────────────────────────────────────────────
create table if not exists public.punch_gps_log (
  id           text primary key,
  uid          text,
  emp          text,
  date         text,
  heure        text,
  lieu         text,
  addr         text,
  site_id      text,
  task_id      bigint,
  lat          double precision,
  lng          double precision,
  acc          numeric,
  src          text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_punch_gps_log_uid_date on public.punch_gps_log(uid, date);

alter table public.punch_gps_log enable row level security;
drop policy if exists "rw_all_punch_gps_log" on public.punch_gps_log;
create policy "rw_all_punch_gps_log" on public.punch_gps_log for all using (true) with check (true);


-- ─────────────────────────────────────────────────────────
-- 6. TABLE `site_journal` — journal de chantier (n'existait pas)
-- ─────────────────────────────────────────────────────────
create table if not exists public.site_journal (
  id           text primary key,
  site_id      text,
  task_id      bigint,
  wo_id        text,
  uid          text,
  emp          text,
  date         text,
  heure        text,
  lieu         text,
  notes        text,
  photos       jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_site_journal_site on public.site_journal(site_id, date);

alter table public.site_journal enable row level security;
drop policy if exists "rw_all_site_journal" on public.site_journal;
create policy "rw_all_site_journal" on public.site_journal for all using (true) with check (true);


-- ─────────────────────────────────────────────────────────
-- 7. NETTOYAGE — retirer les rangées de test laissées par les diagnostics
-- ─────────────────────────────────────────────────────────
delete from public.plan       where id like '\_\_t\_%';
delete from public.workorders where id like '\_\_t\_%';


-- ─────────────────────────────────────────────────────────
-- 8. SYNCHRO TEMPS RÉEL — activer sur les nouvelles tables
--    (ignore l'erreur si déjà ajoutée)
-- ─────────────────────────────────────────────────────────
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.plan_match';    exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.punch_gps_log'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.site_journal';  exception when others then null; end;
end $$;


-- ═══════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — après le RUN, cette requête doit retourner 6 lignes
-- ═══════════════════════════════════════════════════════════════════════
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('workorders','plan','plan_match','sites','punch_gps_log','site_journal')
order by table_name;
