-- 2026-10-02 — Module Communication (sa-admin) : infolettre du lundi, informations, lettres, procédures,
-- internes ou externes au département ; lecture et accusé de lecture dans sa-terrain.
-- Même niveau d'accès que les autres tables partagées (clé publique) — voir la limite connue de sécurité.
create table if not exists public.communications (
  id text primary key,
  type text not null default 'information',          -- infolettre | information | lettre | procedure
  portee text not null default 'interne',            -- interne | externe
  titre text not null default '',
  resume text,
  contenu text,                                      -- corps (lettre, information, procédure)
  sections jsonb not null default '[]'::jsonb,       -- infolettre : [{titre, texte}]
  semaine text,                                      -- infolettre : lundi de la semaine (AAAA-MM-JJ)
  destinataires text,                                -- externe : nom(s) / organisme ; interne : « Toute l'équipe » ou département
  courriels text,                                    -- adresses, séparées par des virgules
  reference text,                                    -- n° de procédure / référence de lettre
  version integer not null default 1,
  confirmation boolean not null default false,       -- lecture à confirmer par chaque employé
  statut text not null default 'brouillon',          -- brouillon | publie | archive
  date_pub date,
  epingle boolean not null default false,
  auteur text, auteur_nom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.communication_lectures (
  id text primary key,                               -- <comm_id>_<uid>
  comm_id text not null,
  uid text not null,
  emp_nom text,
  version integer,
  lu_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communication_lectures_comm on public.communication_lectures(comm_id);
alter table public.communications enable row level security;
alter table public.communication_lectures enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='communications' and policyname='comm_all') then
    create policy comm_all on public.communications for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='communication_lectures' and policyname='comml_select') then
    create policy comml_select on public.communication_lectures for select to anon using (true);
    create policy comml_insert on public.communication_lectures for insert to anon with check (true);
    create policy comml_update on public.communication_lectures for update to anon using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on public.communications to anon;
grant select, insert, update on public.communication_lectures to anon;
notify pgrst, 'reload schema';
