-- ═══════════════════════════════════════════════════════════════
-- SA Platform — création de la table punch_gps_log (journal GPS des punchs)
-- À coller UNE SEULE FOIS dans Supabase → SQL Editor → Run
-- Sert aux statistiques et à la précision de la carte de suivi.
-- N'affecte PAS les feuilles de temps (heures/paie) — table 100% additive.
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.punch_gps_log (
  id           text primary key,
  uid          text,          -- id du compte employé
  emp          text,          -- nom complet (lisible)
  date         text,          -- YYYY-MM-DD
  heure        text,          -- HH:MM du punch
  lieu         text,          -- nom du chantier/site saisi
  addr         text,          -- adresse exacte
  site_id      text,          -- lien vers la fiche site (si connu)
  task_id      text,          -- lien vers la tâche de punch correspondante
  lat          double precision,
  lng          double precision,
  acc          numeric,       -- précision GPS en mètres (si src='gps')
  src          text,          -- 'gps' | 'site' | 'addr' | 'none' | 'pending'
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_punch_gps_log_uid_date on public.punch_gps_log(uid, date);

alter table public.punch_gps_log enable row level security;

drop policy if exists "rw_all_punch_gps_log" on public.punch_gps_log;
create policy "rw_all_punch_gps_log" on public.punch_gps_log for all using (true) with check (true);

-- Synchro temps réel
alter publication supabase_realtime add table public.punch_gps_log;
