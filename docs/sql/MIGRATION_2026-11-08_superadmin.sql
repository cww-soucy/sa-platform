-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 2026-11-08 — Rôle « superadmin » (créateur)
-- À coller UNE SEULE FOIS dans Supabase → SQL Editor → Run (projet ldqvdiaewvhnukuaxdmc).
-- NE crée AUCUNE table → rien à grant. N'applique rien automatiquement.
--
-- Objectif :
--   • Un rôle au-dessus d'« admin », plafonné à 2 comptes.
--   • Pouvoirs complets : le superadmin HÉRITE de tous les droits RLS d'un admin,
--     SANS réécrire les politiques existantes — on fait simplement que sa_role()
--     renvoie 'admin' pour un superadmin (les politiques acceptent déjà 'admin').
--   • Sa fiche compte est protégée : un admin ordinaire ne peut NI la modifier NI la
--     supprimer (politiques « restrictive » basées sur le rôle RÉEL).
--   • Traçabilité conservée : sa_compte() renvoie toujours le vrai identifiant, donc
--     audit_log et les écritures gardent l'identité réelle du superadmin.
--
-- Discrétion : purement applicative (sa-admin). Le superadmin n'apparaît dans aucune
--   liste employés / punch / paie, et se montre dans l'écran Comptes sous l'étiquette
--   « Superviseur » tant que droits.sa_visibilite = 'superviseur' (sinon masqué).
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Rôle réel (pour les protections ci-dessous) — même corps que l'ancien sa_role().
create or replace function public.sa_role_reel() returns text
  language sql stable security definer set search_path = '' as $$
  select c.role from public.comptes c
   where c.id = public.sa_compte() and coalesce(c.statut, 'actif') <> 'inactif' $$;

-- 2) sa_role() : un superadmin est vu comme 'admin' par les politiques RLS existantes.
--    => il obtient d'un coup tous les droits d'écriture/suppression d'un admin,
--    sans modifier aucune autre politique. L'app, elle, lit comptes.role directement
--    (verifier_connexion / comptes_publics) et distingue donc bien le superadmin.
create or replace function public.sa_role() returns text
  language sql stable security definer set search_path = '' as $$
  select case
           when r.role = 'superadmin' then 'admin'   -- hérite des droits admin
           else r.role
         end
    from (select c.role from public.comptes c
           where c.id = public.sa_compte() and coalesce(c.statut, 'actif') <> 'inactif') r $$;

revoke execute on function public.sa_role(), public.sa_role_reel() from public, anon;
grant  execute on function public.sa_role(), public.sa_role_reel() to authenticated, service_role;

-- 3) Protection de la fiche superadmin (politiques RESTRICTIVE : s'additionnent en ET).
--    Une ligne dont le rôle réel est 'superadmin' n'est modifiable/supprimable que par
--    un superadmin. Les lignes normales ne sont pas affectées.
drop policy if exists sa_superadmin_protege_update on public.comptes;
create policy sa_superadmin_protege_update on public.comptes
  as restrictive
  for update to authenticated
  using  (role is distinct from 'superadmin' or public.sa_role_reel() = 'superadmin')
  with check (role is distinct from 'superadmin' or public.sa_role_reel() = 'superadmin');

drop policy if exists sa_superadmin_protege_delete on public.comptes;
create policy sa_superadmin_protege_delete on public.comptes
  as restrictive
  for delete to authenticated
  using (role is distinct from 'superadmin' or public.sa_role_reel() = 'superadmin');

-- 4) Plafond strict : jamais plus de 2 superadmins.
create or replace function public.sa_max_superadmin() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.comptes where role = 'superadmin') > 2 then
    raise exception 'Maximum de 2 superadmins atteint';
  end if;
  return null;
end $$;

drop trigger if exists trg_sa_max_superadmin on public.comptes;
create constraint trigger trg_sa_max_superadmin
  after insert or update of role on public.comptes
  deferrable initially immediate
  for each row when (new.role = 'superadmin')
  execute function public.sa_max_superadmin();

-- 5) Promotion du créateur (cwweil), visibilité « superviseur » par défaut.
update public.comptes
   set role   = 'superadmin',
       droits = coalesce(droits, '{}'::jsonb) || '{"sa_visibilite":"superviseur"}'::jsonb,
       updated_at = now()
 where id = 'cwweil';

-- 6) Resynchronise l'utilisateur Supabase Auth du compte (métadonnées à jour).
select public.sa_auth_sync('cwweil');

-- Vérifications (facultatif) :
-- select id, role, droits->>'sa_visibilite' from public.comptes where role = 'superadmin';
-- select public.sa_role(), public.sa_role_reel();   -- connecté en superadmin → 'admin', 'superadmin'

-- ───────────────────────────── RETOUR ARRIÈRE ─────────────────────────────
-- update public.comptes set role = 'admin',
--        droits = droits - 'sa_visibilite', updated_at = now() where id = 'cwweil';
-- select public.sa_auth_sync('cwweil');
-- drop trigger if exists trg_sa_max_superadmin on public.comptes;
-- drop function if exists public.sa_max_superadmin();
-- drop policy if exists sa_superadmin_protege_update on public.comptes;
-- drop policy if exists sa_superadmin_protege_delete on public.comptes;
-- -- Restaurer l'ancien sa_role() (sans la bascule superadmin→admin) :
-- create or replace function public.sa_role() returns text
--   language sql stable security definer set search_path = '' as $$
--   select c.role from public.comptes c
--    where c.id = public.sa_compte() and coalesce(c.statut, 'actif') <> 'inactif' $$;
-- revoke execute on function public.sa_role() from public, anon;
-- grant  execute on function public.sa_role() to authenticated, service_role;
-- drop function if exists public.sa_role_reel();
