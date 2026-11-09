-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 2026-11-09 — Le superadmin peut définir / réinitialiser les mots de passe
-- À coller UNE SEULE FOIS dans Supabase → SQL Editor → Run (projet ldqvdiaewvhnukuaxdmc).
--
-- Problème : admin_definir_mdp() et reinitialiser_mdp() vérifient « role = 'admin' » en
-- lisant comptes.role en direct. Un superadmin (role = 'superadmin') était donc refusé —
-- impossible de définir un mot de passe en enregistrant un compte. (La bascule de sa_role()
-- ne couvre que les politiques RLS, pas ces fonctions.) On élargit le contrôle à
-- ('admin','superadmin'). Aucun autre comportement modifié.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_definir_mdp(p_admin_id text, p_admin_mdp text, p_cible_id text, p_nouveau text)
 returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare v_ok boolean := false; v_role text;
begin
  select (s.mdp_hash is not null and s.mdp_hash = crypt(p_admin_mdp, s.mdp_hash)), c.role into v_ok, v_role
    from public.comptes c left join public.comptes_secrets s on s.id = c.id where c.id = p_admin_id;
  if v_ok is null or v_ok = false or v_role not in ('admin','superadmin') then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_admin_id, 'ECHEC_CONNEXION', 'comptes.mdp', p_cible_id, jsonb_build_object('motif','définition de mot de passe refusée'));
    return false;
  end if;
  if length(coalesce(p_nouveau,'')) < 8 then raise exception 'Le mot de passe doit contenir au moins 8 caractères'; end if;
  if not exists (select 1 from public.comptes c where c.id = p_cible_id) then raise exception 'Compte introuvable'; end if;
  insert into public.comptes_secrets (id, mdp_hash, mdp_maj_le, doit_changer_mdp)
  values (p_cible_id, crypt(p_nouveau, gen_salt('bf', 10)), now(), true)
  on conflict (id) do update set mdp_hash = excluded.mdp_hash, mdp_maj_le = excluded.mdp_maj_le, doit_changer_mdp = true;
  insert into public.audit_log(acteur, action, ressource, ressource_id, details)
  values (p_admin_id, 'MODIFICATION', 'comptes.mdp', p_cible_id, jsonb_build_object('motif','définition par administrateur'));
  return true;
end $function$;

create or replace function public.reinitialiser_mdp(p_admin_id text, p_cible_id text, p_nouveau text)
 returns boolean language plpgsql security definer set search_path to 'public', 'extensions'
as $function$
declare v_role text;
begin
  select c.role into v_role from public.comptes c where c.id = p_admin_id;
  if v_role not in ('admin','superadmin') then raise exception 'Accès refusé : réservé aux administrateurs'; end if;
  if length(coalesce(p_nouveau,'')) < 8 then raise exception 'Le mot de passe doit contenir au moins 8 caractères'; end if;
  if not exists (select 1 from public.comptes c where c.id = p_cible_id) then raise exception 'Compte introuvable'; end if;
  insert into public.comptes_secrets (id, mdp_hash, mdp_maj_le, doit_changer_mdp)
  values (p_cible_id, crypt(p_nouveau, gen_salt('bf', 10)), now(), true)
  on conflict (id) do update set mdp_hash = excluded.mdp_hash, mdp_maj_le = excluded.mdp_maj_le, doit_changer_mdp = true;
  insert into public.audit_log(acteur, action, ressource, ressource_id, details)
  values (p_admin_id, 'MODIFICATION', 'comptes.mdp', p_cible_id, jsonb_build_object('motif','réinitialisation par administrateur'));
  return true;
end $function$;

-- ───────────────────────────── RETOUR ARRIÈRE ─────────────────────────────
-- Remettre « is distinct from 'admin' » / « is distinct from 'admin' » dans les deux fonctions
-- (versions d'origine dans SECURISATION_ETAPE1/2.sql et le schéma de prod).
