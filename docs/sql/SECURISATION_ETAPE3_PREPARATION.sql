-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- SÉCURISATION — ÉTAPE 3, PRÉPARATION : un compte de connexion Supabase Auth par compte SA
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- À appliquer AVANT la fusion de la PR des apps, puis AVANT SECURISATION_ETAPE3.sql.
-- SANS EFFET sur les apps actuelles : aucune politique, aucun droit n'est modifié ici.
--
-- Ce que ça fait :
--   1. Pour chaque compte de public.comptes qui a un mot de passe (comptes_secrets), crée un utilisateur
--      auth.users avec le MÊME haché bcrypt (aucun mot de passe ne change, personne n'a rien à refaire).
--      Courriel technique : <identifiant>@comptes.soucyaquatik.local (jamais utilisé pour envoyer quoi que ce soit).
--      Le jeton signé par le serveur porte app_metadata.compte_id (l'identifiant SA) et app_metadata.app_role.
--   2. Garde les deux en phase, automatiquement, par déclencheurs :
--      - changer_mdp, admin_definir_mdp, reinitialiser_mdp écrivent dans comptes_secrets → le haché suit ;
--      - rôle / statut modifiés dans comptes → app_role suit ; compte « inactif » → connexion refusée (banned_until) ;
--      - compte supprimé → utilisateur supprimé (ses jetons de renouvellement avec lui).
--   3. Fonctions lues par les politiques de l'étape 3 : sa_compte() (identifiant du jeton) et sa_role()
--      (rôle relu dans comptes à chaque requête : un changement de rôle ou une désactivation agit tout de suite,
--      sans attendre l'expiration du jeton).
--   4. carnet_site_nom(site) : nom du site pour le carnet de bord QR (page publique), qui lisait la table sites.
--
-- Vérification après exécution (SQL Editor) :
--   select c.id, u.email, u.raw_app_meta_data->>'app_role' role, u.banned_until
--     from public.comptes c left join auth.users u on u.email = public.sa_courriel(c.id) order by 1;
--   → une ligne auth.users par compte qui a un mot de passe ; les comptes inactifs ont banned_until en 2999.
-- Puis, dans sa-terrain : se déconnecter / se reconnecter → les requêtes portent « Authorization: Bearer eyJ… »
-- (outils du navigateur, onglet Réseau) au lieu de la clé sb_publishable_….
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
begin;

-- Courriel technique d'un compte (identifiant en minuscules)
create or replace function public.sa_courriel(p_id text) returns text
  language sql immutable set search_path = '' as $$ select lower(p_id) || '@comptes.soucyaquatik.local' $$;

-- Identifiant SA porté par le jeton de la requête (null sans jeton : clé publique seule)
create or replace function public.sa_compte() returns text
  language sql stable set search_path = '' as $$ select nullif(auth.jwt() -> 'app_metadata' ->> 'compte_id', '') $$;

-- Rôle actuel du compte du jeton, relu dans comptes ; null si compte inconnu ou inactif
create or replace function public.sa_role() returns text
  language sql stable security definer set search_path = '' as $$
  select c.role from public.comptes c where c.id = public.sa_compte() and coalesce(c.statut, 'actif') <> 'inactif' $$;

-- Crée, met à jour ou supprime l'utilisateur Supabase Auth d'un compte SA
create or replace function public.sa_auth_sync(p_id text) returns void
  language plpgsql security definer set search_path = '' as $$
declare c public.comptes; v_hash text; u uuid; e text := public.sa_courriel(p_id); meta jsonb; ban timestamptz;
begin
  select * into c from public.comptes where id = p_id;
  select id into u from auth.users where email = e;
  if c.id is null then                                    -- compte supprimé
    if u is not null then delete from auth.users where id = u; end if;
    return;
  end if;
  select s.mdp_hash into v_hash from public.comptes_secrets s where s.id = p_id;
  meta := jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'compte_id', c.id, 'app_role', coalesce(c.role, 'employe'));
  ban := case when coalesce(c.statut, 'actif') = 'inactif' then timestamptz '2999-12-31' end;
  if u is null then
    if v_hash is null then return; end if;                -- pas encore de mot de passe : rien à créer
    u := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, banned_until)
    values ('00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', e, v_hash, now(), meta, '{}'::jsonb,
            now(), now(), '', '', '', '', ban);
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (u::text, u, jsonb_build_object('sub', u::text, 'email', e, 'email_verified', true), 'email', now(), now());
  else
    update auth.users set encrypted_password = coalesce(v_hash, encrypted_password),
                          raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || meta,
                          banned_until = ban, updated_at = now()
     where id = u;
  end if;
end $$;

create or replace function public.sa_auth_sync_trg() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  perform public.sa_auth_sync(case when tg_op = 'DELETE' then old.id else new.id end);
  return null;
end $$;

drop trigger if exists trg_sa_auth_secret on public.comptes_secrets;
create trigger trg_sa_auth_secret after insert or update or delete on public.comptes_secrets
  for each row execute function public.sa_auth_sync_trg();
drop trigger if exists trg_sa_auth_compte on public.comptes;
create trigger trg_sa_auth_compte after insert or update of role, statut or delete on public.comptes
  for each row execute function public.sa_auth_sync_trg();

-- Carnet de bord QR (page publique) : seulement le nom du site
create or replace function public.carnet_site_nom(p_site text) returns text
  language sql stable security definer set search_path = '' as $$ select s.nom from public.sites s where s.id = p_site $$;

revoke execute on function public.sa_auth_sync(text), public.sa_auth_sync_trg() from public, anon, authenticated;
revoke execute on function public.sa_role(), public.sa_compte(), public.sa_courriel(text) from public, anon;
grant execute on function public.sa_role(), public.sa_compte(), public.sa_courriel(text) to authenticated, service_role;
grant execute on function public.carnet_site_nom(text) to anon, authenticated, service_role;

-- Comptes existants
do $$ declare r record; begin for r in select id from public.comptes loop perform public.sa_auth_sync(r.id); end loop; end $$;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- RETOUR ARRIÈRE (seulement si SECURISATION_ETAPE3.sql n'est PAS appliquée, ou après son propre retour arrière)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop trigger if exists trg_sa_auth_secret on public.comptes_secrets;
-- drop trigger if exists trg_sa_auth_compte on public.comptes;
-- drop function if exists public.sa_auth_sync_trg();
-- drop function if exists public.sa_auth_sync(text);
-- drop function if exists public.carnet_site_nom(text);
-- drop function if exists public.sa_role();
-- drop function if exists public.sa_compte();
-- delete from auth.users where email like '%@comptes.soucyaquatik.local';
-- drop function if exists public.sa_courriel(text);
-- commit;
-- Les apps retombent d'elles-mêmes sur la clé publique quand la connexion par jeton échoue.
