-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-11-19 — Modules ACTIVABLES / DÉSACTIVABLES (sa-admin › Affichage des apps › Modules)
-- Demande de la direction : pouvoir activer ou désactiver réellement des fonctions de l'app, pas seulement les masquer.
-- Un module désactivé l'est pour tout le monde, administrateurs compris :
--   • les apps le retirent (menu, onglets, tuiles) et refusent de l'ouvrir par un lien direct ;
--   • LA BASE refuse ses données : lecture vide, écriture refusée (politiques RLS « restrictive » ci-dessous),
--     même pour quelqu'un qui appellerait l'API directement avec un jeton valide ou la clé publique.
-- Rien n'est effacé : réactiver le module remet tout comme avant.
-- Le catalogue des modules (noms, écrans, tables) est dans src/affichage/affichage.js (SAAff.MODULES) ;
-- la liste des tables ci-dessous doit lui correspondre (vérifié par tests/modules-actifs.test.js).
--
-- Additif : sans ligne dans modules_etat, tout module est ACTIVÉ ; aucune politique existante n'est modifiée
-- (une politique « restrictive » s'ajoute aux autres : il faut les deux pour lire ou écrire).
-- Les fonctions serveur (clé service_role) ne sont pas bloquées par RLS.
-- Prérequis : public.sa_role() (SECURISATION_ETAPE3_PREPARATION.sql, déjà en place en production).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

do $$ begin
  if to_regprocedure('public.sa_role()') is null then
    raise exception 'public.sa_role() absente : appliquer d''abord SECURISATION_ETAPE3_PREPARATION.sql';
  end if;
end $$;

create table if not exists public.modules_etat (
  id text primary key,
  actif boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table public.modules_etat enable row level security;

grant select, insert, update, delete on public.modules_etat to authenticated;
grant select, insert, update, delete on public.modules_etat to service_role;

-- Lecture : tout compte connecté actif (les apps l'appliquent). Écriture : administrateurs seulement.
drop policy if exists modules_etat_lecture on public.modules_etat;
create policy modules_etat_lecture on public.modules_etat for select to authenticated
  using ((select public.sa_role()) is not null);
drop policy if exists modules_etat_ecriture on public.modules_etat;
create policy modules_etat_ecriture on public.modules_etat for all to authenticated
  using ((select public.sa_role()) = 'admin')
  with check ((select public.sa_role()) = 'admin');

-- Le module est-il activé ? (sans ligne : oui). SECURITY DEFINER : utilisable dans les politiques, y compris
-- pour une page publique (sondages) ; ne révèle que l'état d'un module.
create or replace function public.sa_module_actif(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select actif from public.modules_etat where id = p_module), true)
$$;
revoke execute on function public.sa_module_actif(text) from public;
grant execute on function public.sa_module_actif(text) to anon, authenticated, service_role;

-- Blocage côté base : une politique RESTRICTIVE par table de module (s'ajoute aux politiques existantes)
do $$
declare
  r record;
begin
  for r in select * from (values
      ('facturation',            '(select public.sa_module_actif(''facturation''))'),
      ('projets_excel',          '(select public.sa_module_actif(''facturation''))'),
      ('plan_match',             '(select public.sa_module_actif(''planmatch''))'),
      ('bons_livraison',         '(select public.sa_module_actif(''logistique''))'),
      ('sorties_inventaire',     '(select public.sa_module_actif(''logistique''))'),
      ('logistique_config',      '(select public.sa_module_actif(''logistique''))'),
      -- les produits servent aussi aux sorties d'inventaire de la Logistique
      ('inventaire',             '((select public.sa_module_actif(''stock'')) or (select public.sa_module_actif(''logistique'')))'),
      ('flotte',                 '(select public.sa_module_actif(''flotte''))'),
      ('outils',                 '(select public.sa_module_actif(''outils''))'),
      ('outils_mouvements',      '(select public.sa_module_actif(''outils''))'),
      ('rapports_hivernage',     '(select public.sa_module_actif(''hivernage''))'),
      ('sondages',               '(select public.sa_module_actif(''sondages''))'),
      ('sondage_reponses',       '(select public.sa_module_actif(''sondages''))'),
      ('communications',         '(select public.sa_module_actif(''communication''))'),
      ('communication_lectures', '(select public.sa_module_actif(''communication''))'),
      ('demandes',               '(select public.sa_module_actif(''demandes''))')
    ) as t(tbl, cond)
  loop
    if to_regclass('public.' || r.tbl) is null then
      raise notice 'table % absente : ignorée', r.tbl; continue;
    end if;
    execute format('drop policy if exists module_actif on public.%I', r.tbl);
    execute format('create policy module_actif on public.%I as restrictive for all to anon, authenticated using (%s) with check (%s)', r.tbl, r.cond, r.cond);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Vérification (doit répondre : modules_etat | t | 0, puis 16)
-- select 'modules_etat', relrowsecurity, (select count(*) from public.modules_etat) from pg_class where relname = 'modules_etat';
-- select count(*) from pg_policies where schemaname = 'public' and policyname = 'module_actif' and permissive = 'RESTRICTIVE';
-- Les tables doivent avoir RLS activé (c'est le cas depuis l'étape 3) ; sinon la politique est sans effet :
-- select relname from pg_class where relname in ('facturation','flotte','inventaire') and not relrowsecurity;

-- ── Retour arrière ─────────────────────────────────────────────────────────────────────────────
-- do $$ declare t text; begin foreach t in array array['facturation','projets_excel','plan_match','bons_livraison','sorties_inventaire',
--   'logistique_config','inventaire','flotte','outils','outils_mouvements','rapports_hivernage','sondages','sondage_reponses',
--   'communications','communication_lectures','demandes'] loop execute format('drop policy if exists module_actif on public.%I', t); end loop; end $$;
-- drop function if exists public.sa_module_actif(text);
-- drop table if exists public.modules_etat;
-- (les apps reviennent d'elles-mêmes à « tout activé » : elles ignorent une table absente)
