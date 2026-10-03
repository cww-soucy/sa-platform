-- ═══════════════════════════════════════════════════════════════════════════
-- Mot de passe défini par un administrateur depuis sa-admin — APPLIQUÉ en production le 2026-09-29
-- (après répétition annulée : mauvais mot de passe admin refusé, bon mot de passe accepté,
--  connexion de l'employé OK, changement exigé à la prochaine connexion).
-- L'administrateur confirme SON mot de passe, vérifié côté serveur ; rôle 'admin' exigé ; le haché
-- ne quitte jamais la base ; chaque tentative (réussie ou refusée) est inscrite au journal d'audit.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.admin_definir_mdp(p_admin_id text, p_admin_mdp text, p_cible_id text, p_nouveau text)
returns boolean language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_ok boolean := false; v_role text;
begin
  select (s.mdp_hash is not null and s.mdp_hash = crypt(p_admin_mdp, s.mdp_hash)), c.role into v_ok, v_role
    from public.comptes c left join public.comptes_secrets s on s.id = c.id where c.id = p_admin_id;
  if v_ok is null or v_ok = false or v_role is distinct from 'admin' then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_admin_id, 'ECHEC_CONNEXION', 'comptes.mdp', p_cible_id, jsonb_build_object('motif','définition de mot de passe refusée'));
    return false;
  end if;
  if length(coalesce(p_nouveau,'')) < 8 then raise exception 'Le mot de passe doit contenir au moins 8 caractères'; end if;
  if not exists (select 1 from public.comptes c where c.id = p_cible_id) then raise exception 'Compte introuvable'; end if;
  insert into public.comptes_secrets (id, mdp_hash, mdp_maj_le, doit_changer_mdp)
  values (p_cible_id, crypt(p_nouveau, gen_salt('bf', 10)), now(), p_cible_id <> p_admin_id)
  on conflict (id) do update set mdp_hash = excluded.mdp_hash, mdp_maj_le = excluded.mdp_maj_le, doit_changer_mdp = excluded.doit_changer_mdp;
  insert into public.audit_log(acteur, action, ressource, ressource_id, details)
  values (p_admin_id, 'MODIFICATION', 'comptes.mdp', p_cible_id, jsonb_build_object('motif','mot de passe défini par un administrateur (sa-admin)'));
  return true;
end $$;
revoke all on function public.admin_definir_mdp(text,text,text,text) from public;
grant execute on function public.admin_definir_mdp(text,text,text,text) to anon, authenticated;
