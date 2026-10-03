-- ═══════════════════════════════════════════════════════════════════════════
-- SA PLATFORM — SÉCURISATION ÉTAPE 2 : les hachés de mots de passe sortent de `comptes`
-- ═══════════════════════════════════════════════════════════════════════════
-- CONSTAT (29/09/2026) : l'étape 1 voulait rendre `comptes` illisible (politique
-- comptes_no_direct_read = false), mais l'ancienne politique `acces_equipe` (ALL, true) n'a
-- jamais été retirée. Les politiques permissives s'additionnent : la table restait donc
-- lisible ET modifiable avec la clé publique. Conséquences :
--   ❌ les 9 hachés bcrypt (mdp_hash) téléchargeables par n'importe qui ;
--   ❌ n'importe qui pouvait ÉCRIRE un haché connu dans mdp_hash → prise de contrôle d'un compte ;
--   ❌ index.html renvoie son cache local de `comptes` (avec mdp_hash) à chaque ouverture :
--      un appareil au cache ancien pouvait annuler un changement de mot de passe.
--
-- On NE retire PAS acces_equipe : index.html lit (select *) et écrit (upsert) `comptes`
-- directement pour l'écran Comptes — le fermer casserait l'app en production.
-- À la place, les secrets déménagent dans `comptes_secrets`, fermée à l'API publique ;
-- dans `comptes`, mdp et mdp_hash restent toujours vides, quoi que le navigateur envoie.
--
-- Compatible sans aucune modification des apps : la connexion (verifier_connexion), le
-- changement (changer_mdp) et la réinitialisation (reinitialiser_mdp) gardent la même
-- signature et le même comportement.
--
-- RESTE OUVERT (étape 3, demande une vraie authentification serveur) : la clé publique
-- permet toujours de modifier `role`/`droits` d'un compte existant et d'en créer. Sans
-- haché lisible ni modifiable, il faut désormais un vrai mot de passe pour en profiter.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Table des secrets : RLS activée, AUCUNE politique, aucun droit pour anon/authenticated.
create table if not exists public.comptes_secrets (
  id               text primary key,
  mdp_hash         text not null,
  mdp_maj_le       timestamptz,
  doit_changer_mdp boolean not null default false
);
alter table public.comptes_secrets enable row level security;
revoke all on public.comptes_secrets from public, anon, authenticated;
comment on table public.comptes_secrets is
  'Hachés bcrypt des mots de passe. Jamais exposée à l''API : accès uniquement par les fonctions security definer (verifier_connexion, changer_mdp, reinitialiser_mdp).';

insert into public.comptes_secrets (id, mdp_hash, mdp_maj_le, doit_changer_mdp)
select id, mdp_hash, mdp_maj_le, coalesce(doit_changer_mdp, false)
  from public.comptes
 where coalesce(mdp_hash, '') <> ''
on conflict (id) do nothing;

-- 2. `comptes` ne contient plus jamais de secret, quel que soit l'auteur de l'écriture.
create or replace function public.proteger_secrets_comptes()
returns trigger language plpgsql set search_path = public as $$
begin
  new.mdp := null;
  new.mdp_hash := null;
  if tg_op = 'UPDATE' then
    -- informatif seulement (la vérité est dans comptes_secrets) : le navigateur ne peut pas le changer
    new.mdp_maj_le := old.mdp_maj_le;
    new.doit_changer_mdp := old.doit_changer_mdp;
  end if;
  return new;
end $$;

drop trigger if exists trg_proteger_mdp on public.comptes;
drop trigger if exists trg_proteger_secrets on public.comptes;
create trigger trg_proteger_secrets before insert or update on public.comptes
  for each row execute function public.proteger_secrets_comptes();

-- Un compte supprimé emporte son secret (anon n'a pas accès à comptes_secrets → security definer).
create or replace function public.supprimer_secret_compte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.comptes_secrets where id = old.id;
  return old;
end $$;
revoke all on function public.supprimer_secret_compte() from public, anon, authenticated;
drop trigger if exists trg_supprimer_secret on public.comptes;
create trigger trg_supprimer_secret after delete on public.comptes
  for each row execute function public.supprimer_secret_compte();

-- Effacement des hachés dans la table lisible (déjà copiés à l'étape 1 de ce script).
update public.comptes set mdp = null, mdp_hash = null
 where mdp is not null or mdp_hash is not null;

drop function if exists public.proteger_mdp_hash();

-- 3. Fonctions : même signature, même comportement, secrets lus dans comptes_secrets.
create or replace function public.verifier_connexion(p_id text, p_mdp text)
returns table (id text, prenom text, nom text, role text, dept text, email text, tel text,
               droits jsonb, doit_changer_mdp boolean, statut text, saisonnier boolean)
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_ok boolean := false; v_statut text;
begin
  select (s.mdp_hash is not null and s.mdp_hash = crypt(p_mdp, s.mdp_hash)), c.statut
    into v_ok, v_statut
    from public.comptes c left join public.comptes_secrets s on s.id = c.id
   where c.id = p_id;

  if v_ok is null or v_ok = false then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_id, 'ECHEC_CONNEXION', 'comptes', p_id, jsonb_build_object('motif','identifiants invalides'));
    return;
  end if;

  if coalesce(v_statut,'actif') = 'inactif' then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_id, 'ECHEC_CONNEXION', 'comptes', p_id, jsonb_build_object('motif','compte désactivé'));
    return;
  end if;

  insert into public.audit_log(acteur, action, ressource, ressource_id)
  values (p_id, 'CONNEXION', 'comptes', p_id);

  return query
    select c.id, c.prenom, c.nom, c.role, c.dept, c.email, c.tel,
           to_jsonb(c.droits),
           coalesce(s.doit_changer_mdp, false),
           coalesce(c.statut,'actif'),
           coalesce(c.saisonnier,false)
      from public.comptes c left join public.comptes_secrets s on s.id = c.id
     where c.id = p_id;
end $$;

create or replace function public.changer_mdp(p_id text, p_ancien text, p_nouveau text)
returns boolean
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_ok boolean := false;
begin
  if length(coalesce(p_nouveau,'')) < 8 then
    raise exception 'Le mot de passe doit contenir au moins 8 caractères';
  end if;

  select (s.mdp_hash is not null and s.mdp_hash = crypt(p_ancien, s.mdp_hash))
    into v_ok from public.comptes_secrets s where s.id = p_id;

  if v_ok is null or v_ok = false then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_id, 'ECHEC_CONNEXION', 'comptes', p_id, jsonb_build_object('motif','ancien mot de passe invalide'));
    return false;
  end if;

  update public.comptes_secrets
     set mdp_hash = crypt(p_nouveau, gen_salt('bf', 10)),
         mdp_maj_le = now(),
         doit_changer_mdp = false
   where id = p_id;

  insert into public.audit_log(acteur, action, ressource, ressource_id)
  values (p_id, 'MODIFICATION', 'comptes.mdp', p_id);

  return true;
end $$;

create or replace function public.reinitialiser_mdp(p_admin_id text, p_cible_id text, p_nouveau text)
returns boolean
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_role text;
begin
  select c.role into v_role from public.comptes c where c.id = p_admin_id;
  if v_role is distinct from 'admin' then
    raise exception 'Accès refusé : réservé aux administrateurs';
  end if;

  if length(coalesce(p_nouveau,'')) < 8 then
    raise exception 'Le mot de passe doit contenir au moins 8 caractères';
  end if;

  if not exists (select 1 from public.comptes c where c.id = p_cible_id) then
    raise exception 'Compte introuvable';
  end if;

  insert into public.comptes_secrets (id, mdp_hash, mdp_maj_le, doit_changer_mdp)
  values (p_cible_id, crypt(p_nouveau, gen_salt('bf', 10)), now(), true)  -- l'employé devra le changer
  on conflict (id) do update
     set mdp_hash = excluded.mdp_hash, mdp_maj_le = excluded.mdp_maj_le, doit_changer_mdp = true;

  insert into public.audit_log(acteur, action, ressource, ressource_id, details)
  values (p_admin_id, 'MODIFICATION', 'comptes.mdp', p_cible_id,
          jsonb_build_object('motif','réinitialisation par administrateur'));

  return true;
end $$;

-- Droits d'exécution inchangés : connexion et changement ouverts ; réinitialisation fermée à l'API.
revoke all on function public.verifier_connexion(text,text) from public;
grant execute on function public.verifier_connexion(text,text) to anon, authenticated;
revoke all on function public.changer_mdp(text,text,text) from public;
grant execute on function public.changer_mdp(text,text,text) to anon, authenticated;
revoke all on function public.reinitialiser_mdp(text,text,text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════════
-- (1) Plus aucun secret dans la table lisible (attendu : 0) :
--   select count(*) from public.comptes where coalesce(mdp,'') <> '' or coalesce(mdp_hash,'') <> '';
-- (2) Chaque compte qui avait un mot de passe l'a toujours (attendu : 9 au 29/09/2026) :
--   select count(*) from public.comptes_secrets;
-- (3) L'API publique ne voit pas les secrets (attendu : false, false) :
--   select has_table_privilege('anon','public.comptes_secrets','SELECT'), has_table_privilege('anon','public.comptes_secrets','UPDATE');
