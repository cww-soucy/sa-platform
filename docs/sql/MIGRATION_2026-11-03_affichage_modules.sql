-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-11-03 — Affichage configurable des apps (sa-admin › Affichage des apps)
-- La direction choisit ce que chaque profil voit dans sa-admin, sa-terrain et le portail client :
-- modules du menu, onglets, sections. Une ligne par app et par profil :
--   id = '<app>|<cible>'  ex. 'admin|tous', 'terrain|role:employe', 'admin|compte:kael', 'portail|niveau:operateur'
--   masques = {"<clé>": true (masqué) | false (réaffiché)} ; une clé absente = héritée du profil plus général.
-- Le catalogue des clés est dans src/affichage/affichage.js.
-- Additif : aucune table existante n'est touchée. Sans ligne, tout reste visible comme avant.
-- Lecture : tout compte connecté actif (les apps l'appliquent à l'ouverture). Écriture : admin et superviseur.
-- Le portail client la lit par sa fonction serveur (service_role), seulement les profils du client connecté.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- Prérequis : public.sa_role() (SECURISATION_ETAPE3_PREPARATION.sql, déjà en place en production)
do $$ begin
  if to_regprocedure('public.sa_role()') is null then
    raise exception 'public.sa_role() absente : appliquer d''abord SECURISATION_ETAPE3_PREPARATION.sql';
  end if;
end $$;

create table if not exists public.affichage_regles (
  id text primary key,
  app text not null check (app in ('admin', 'terrain', 'portail')),
  cible text not null,
  masques jsonb not null default '{}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint affichage_regles_id check (id = app || '|' || cible)
);
alter table public.affichage_regles enable row level security;

grant select, insert, update, delete on public.affichage_regles to authenticated;
grant select, insert, update, delete on public.affichage_regles to service_role;

drop policy if exists affichage_regles_lecture on public.affichage_regles;
create policy affichage_regles_lecture on public.affichage_regles for select to authenticated
  using ((select public.sa_role()) is not null);
drop policy if exists affichage_regles_ecriture on public.affichage_regles;
create policy affichage_regles_ecriture on public.affichage_regles for all to authenticated
  using ((select public.sa_role()) in ('admin', 'superviseur'))
  with check ((select public.sa_role()) in ('admin', 'superviseur'));

notify pgrst, 'reload schema';

-- Vérification (doit répondre : affichage_regles | t | 0)
-- select 'affichage_regles', relrowsecurity, (select count(*) from public.affichage_regles) from pg_class where relname = 'affichage_regles';

-- ── Retour arrière ─────────────────────────────────────────────────────────────────────────────
-- drop table if exists public.affichage_regles;
-- (les apps reviennent d'elles-mêmes à « tout visible » : elles ignorent une table absente)
