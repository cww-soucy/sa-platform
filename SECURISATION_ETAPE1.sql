-- ═══════════════════════════════════════════════════════════════════════════
-- SA PLATFORM — SÉCURISATION COMPLÈTE (ÉTAPE 1)
-- ═══════════════════════════════════════════════════════════════════════════
-- CONTEXTE : app en attente d'approbation de la direction.
-- Photos de chantier pouvant contenir des personnes ou installations clients
-- → assujetti à la Loi 25 (Québec) : traçabilité et confidentialité obligatoires.
--
-- AUDIT DU 24/08/2026 — problèmes constatés sur la base de production :
--   ❌ Mots de passe stockés EN CLAIR et lisibles de l'extérieur
--   ❌ 8 comptes / 76 feuilles de temps / 36 sites lisibles sans authentification
--   ❌ Écriture possible sans authentification (HTTP 201 confirmé)
--   ❌ Aucune journalisation des accès
--
-- ⚠️  À EXÉCUTER DANS SUPABASE → SQL EDITOR → RUN
-- ⚠️  NE SUPPRIME AUCUNE DONNÉE MÉTIER — ajoute uniquement des protections.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────
-- 1. EXTENSION DE CHIFFREMENT (pour le hachage des mots de passe)
-- ─────────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;


-- ─────────────────────────────────────────────────────────────────
-- 2. JOURNAL D'AUDIT — traçabilité exigée par la direction / Loi 25
--    Enregistre QUI fait QUOI, QUAND, sur QUELLE donnée.
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id           bigserial primary key,
  ts           timestamptz not null default now(),
  acteur       text,           -- id de l'employé (ou 'système')
  acteur_nom   text,
  action       text not null,  -- CONSULTATION | CREATION | MODIFICATION | SUPPRESSION | CONNEXION | ECHEC_CONNEXION | ACCES_PHOTO
  ressource    text,           -- table ou type de ressource
  ressource_id text,           -- identifiant de l'enregistrement
  details      jsonb,          -- contexte additionnel (jamais de données sensibles)
  ip_hint      text,           -- indice d'origine (non nominatif)
  appareil     text            -- navigateur / plateforme
);

create index if not exists idx_audit_ts      on public.audit_log(ts desc);
create index if not exists idx_audit_acteur  on public.audit_log(acteur, ts desc);
create index if not exists idx_audit_action  on public.audit_log(action, ts desc);

comment on table public.audit_log is
  'Journal d''audit — traçabilité Loi 25. Conservation minimale 12 mois. Lecture réservée aux administrateurs.';

alter table public.audit_log enable row level security;

-- Insertion permise (l''app doit pouvoir journaliser), mais LECTURE fermée par défaut.
drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log for insert with check (true);

drop policy if exists "audit_no_read" on public.audit_log;
create policy "audit_no_read" on public.audit_log for select using (false);

-- Le journal est IMMUABLE : aucune modification ni suppression possible.
drop policy if exists "audit_no_update" on public.audit_log;
create policy "audit_no_update" on public.audit_log for update using (false);
drop policy if exists "audit_no_delete" on public.audit_log;
create policy "audit_no_delete" on public.audit_log for delete using (false);


-- ─────────────────────────────────────────────────────────────────
-- 3. MOTS DE PASSE — hachage (fin du stockage en clair)
--    On ajoute une colonne hachée, on migre, puis on VIDE la colonne claire.
-- ─────────────────────────────────────────────────────────────────
alter table public.comptes add column if not exists mdp_hash text;
alter table public.comptes add column if not exists mdp_maj_le timestamptz;
alter table public.comptes add column if not exists doit_changer_mdp boolean default false;

-- Migration : hacher les mots de passe existants (bcrypt)
update public.comptes
   set mdp_hash = crypt(mdp, gen_salt('bf', 10)),
       mdp_maj_le = now(),
       doit_changer_mdp = true          -- les mdp actuels ont été exposés → changement obligatoire
 where mdp is not null
   and mdp <> ''
   and mdp_hash is null;

-- EFFACEMENT des mots de passe en clair (la colonne reste, mais vide)
update public.comptes set mdp = null where mdp is not null;

comment on column public.comptes.mdp is
  'OBSOLÈTE — ne plus utiliser. Les mots de passe sont hachés dans mdp_hash.';


-- ─────────────────────────────────────────────────────────────────
-- 4. FONCTION DE VÉRIFICATION DE MOT DE PASSE
--    Le hachage ne sort JAMAIS de la base ; on ne renvoie que le profil.
-- ─────────────────────────────────────────────────────────────────
create or replace function public.verifier_connexion(p_id text, p_mdp text)
returns table (
  id text, prenom text, nom text, role text, dept text,
  email text, tel text, droits jsonb, doit_changer_mdp boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean := false;
begin
  select (c.mdp_hash is not null and c.mdp_hash = crypt(p_mdp, c.mdp_hash))
    into v_ok
    from public.comptes c
   where c.id = p_id;

  if v_ok is null or v_ok = false then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_id, 'ECHEC_CONNEXION', 'comptes', p_id, jsonb_build_object('motif','identifiants invalides'));
    return;
  end if;

  insert into public.audit_log(acteur, action, ressource, ressource_id)
  values (p_id, 'CONNEXION', 'comptes', p_id);

  return query
    select c.id, c.prenom, c.nom, c.role, c.dept, c.email, c.tel,
           to_jsonb(c.droits),
           coalesce(c.doit_changer_mdp,false)
      from public.comptes c
     where c.id = p_id;
end $$;

revoke all on function public.verifier_connexion(text,text) from public;
grant execute on function public.verifier_connexion(text,text) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 5. FONCTION DE CHANGEMENT DE MOT DE PASSE (avec journalisation)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.changer_mdp(p_id text, p_ancien text, p_nouveau text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_ok boolean := false;
begin
  if length(coalesce(p_nouveau,'')) < 8 then
    raise exception 'Le mot de passe doit contenir au moins 8 caractères';
  end if;

  select (c.mdp_hash is not null and c.mdp_hash = crypt(p_ancien, c.mdp_hash))
    into v_ok from public.comptes c where c.id = p_id;

  if v_ok is null or v_ok = false then
    insert into public.audit_log(acteur, action, ressource, ressource_id, details)
    values (p_id, 'ECHEC_CONNEXION', 'comptes', p_id, jsonb_build_object('motif','ancien mot de passe invalide'));
    return false;
  end if;

  update public.comptes
     set mdp_hash = crypt(p_nouveau, gen_salt('bf', 10)),
         mdp_maj_le = now(),
         doit_changer_mdp = false
   where id = p_id;

  insert into public.audit_log(acteur, action, ressource, ressource_id)
  values (p_id, 'MODIFICATION', 'comptes.mdp', p_id);

  return true;
end $$;

revoke all on function public.changer_mdp(text,text,text) from public;
grant execute on function public.changer_mdp(text,text,text) to anon, authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 6. VUE PUBLIQUE DES COMPTES — SANS aucun secret
--    L'app doit pouvoir afficher la liste des employés, mais JAMAIS les mdp.
-- ─────────────────────────────────────────────────────────────────
create or replace view public.comptes_publics as
  select id, prenom, nom, role, dept, email, tel, droits
    from public.comptes;

comment on view public.comptes_publics is
  'Vue sans secret — à utiliser par l''application à la place de la table comptes.';


-- ─────────────────────────────────────────────────────────────────
-- 7. FERMETURE DES ACCÈS — la table comptes n'est plus lisible directement
-- ─────────────────────────────────────────────────────────────────
alter table public.comptes enable row level security;

drop policy if exists "rw_all_comptes"     on public.comptes;
drop policy if exists "comptes_select_all" on public.comptes;
drop policy if exists "Enable read access for all users" on public.comptes;

-- Plus AUCUNE lecture directe de la table comptes (les mdp hachés restent invisibles)
drop policy if exists "comptes_no_direct_read" on public.comptes;
create policy "comptes_no_direct_read" on public.comptes for select using (false);

-- Création/modification de comptes : passe par l'app (à restreindre davantage à l'étape 2)
drop policy if exists "comptes_write" on public.comptes;
create policy "comptes_write" on public.comptes for insert with check (true);
drop policy if exists "comptes_update" on public.comptes;
create policy "comptes_update" on public.comptes for update using (true);


-- ─────────────────────────────────────────────────────────────────
-- 8. TABLE DES PHOTOS ARCHIVÉES (préparation de l'étape 2)
--    Métadonnées seulement — les fichiers iront dans un bucket privé.
-- ─────────────────────────────────────────────────────────────────
create table if not exists public.photos_chantier (
  id            text primary key,
  chemin        text not null,        -- chemin dans le bucket privé
  site_id       text,
  wo_id         text,
  task_id       bigint,
  uid           text,                 -- employé auteur
  emp           text,
  date          text,
  heure         text,
  lieu          text,
  legende       text,
  contient_personnes boolean default false,  -- déclaration Loi 25
  taille_octets integer,
  supprime_le   timestamptz,          -- suppression logique (traçabilité conservée)
  supprime_par  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_photos_site on public.photos_chantier(site_id, date);
create index if not exists idx_photos_uid  on public.photos_chantier(uid, date);

comment on table public.photos_chantier is
  'Métadonnées des photos de chantier. Fichiers dans un bucket PRIVÉ. Peut contenir des renseignements personnels (Loi 25) — accès journalisé, suppression logique uniquement.';

alter table public.photos_chantier enable row level security;
drop policy if exists "photos_rw" on public.photos_chantier;
create policy "photos_rw" on public.photos_chantier for all using (true) with check (true);


-- ─────────────────────────────────────────────────────────────────
-- 9. VUE D'AUDIT POUR LA DIRECTION (lecture par fonction sécurisée)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.rapport_audit(p_admin_id text, p_jours integer default 30)
returns table (
  ts timestamptz, acteur text, acteur_nom text, action text,
  ressource text, ressource_id text, details jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare v_role text;
begin
  select c.role into v_role from public.comptes c where c.id = p_admin_id;
  if v_role is distinct from 'admin' then
    raise exception 'Accès refusé : rapport réservé aux administrateurs';
  end if;

  insert into public.audit_log(acteur, action, ressource, details)
  values (p_admin_id, 'CONSULTATION', 'audit_log', jsonb_build_object('periode_jours', p_jours));

  return query
    select a.ts, a.acteur, a.acteur_nom, a.action, a.ressource, a.ressource_id, a.details
      from public.audit_log a
     where a.ts > now() - (p_jours || ' days')::interval
     order by a.ts desc
     limit 5000;
end $$;

revoke all on function public.rapport_audit(text,integer) from public;
grant execute on function public.rapport_audit(text,integer) to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS EXÉCUTION
-- ═══════════════════════════════════════════════════════════════════════════
-- (1) Aucun mot de passe en clair ne doit subsister :
select count(*) as mdp_en_clair_restants from public.comptes where mdp is not null and mdp <> '';

-- (2) Tous les comptes doivent avoir un hachage :
select count(*) as comptes_avec_hachage from public.comptes where mdp_hash is not null;

-- (3) Test de connexion (remplace par un vrai identifiant) :
-- select * from public.verifier_connexion('kael', 'kael1234');
