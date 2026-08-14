-- ═══════════════════════════════════════════════════════════════
-- SA Platform — création de la table site_journal (journal de chantier)
-- À coller UNE SEULE FOIS dans Supabase → SQL Editor → Run
-- Notes/photos prises par l'équipe pendant leurs punchs, rattachées au SITE.
-- N'affecte JAMAIS les feuilles de temps (heures/paie) — table 100% additive.
-- ═══════════════════════════════════════════════════════════════
create table if not exists public.site_journal (
  id           text primary key,
  site_id      text,          -- lien vers la fiche site
  task_id      bigint,        -- lien vers la tâche de punch d'origine (évite les doublons à l'édition)
  wo_id        text,          -- lien optionnel vers un Work Order
  uid          text,          -- id du compte employé
  emp          text,          -- nom complet (lisible)
  date         text,          -- YYYY-MM-DD
  heure        text,
  lieu         text,
  notes        text,
  photos       jsonb,         -- [{data, name, addedBy, addedAt}] — images en base64
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_site_journal_site on public.site_journal(site_id, date);

alter table public.site_journal enable row level security;

drop policy if exists "rw_all_site_journal" on public.site_journal;
create policy "rw_all_site_journal" on public.site_journal for all using (true) with check (true);

alter publication supabase_realtime add table public.site_journal;
