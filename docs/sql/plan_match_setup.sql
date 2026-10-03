-- ═══════════════════════════════════════════════════════════════
-- SA Platform — création de la table plan_match (Plans de Match)
-- À coller UNE SEULE FOIS dans Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.plan_match (
  id           text primary key,
  emp          text,          -- ids des employés assignés, séparés par ", " (multi-employés)
  date         text,
  vehicule     text,
  superviseur  text,
  resume       text,
  sections     jsonb,
  obstacles    text,
  bonscoups    text,
  created_by   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.plan_match enable row level security;

drop policy if exists "rw_all_plan_match" on public.plan_match;
create policy "rw_all_plan_match" on public.plan_match for all using (true) with check (true);

-- Synchro temps réel
alter publication supabase_realtime add table public.plan_match;
