-- 2026-10-04 — Refonte Inspections (6 systèmes) + Portail client sécurisé. AJOUTS SEULEMENT (aucune colonne retirée).
-- Passation : docs/design_handoff_inspections_portail/README.md (§7 modèle de données, §9 sécurité du portail).
--
-- Choix d'adaptation à l'existant :
--  * Une visite d'inspection = une ligne de `releves` par bassin (comme aujourd'hui) + les états des points dans
--    `releves.points` (jsonb). Les relevés d'eau restent dans `vals` ; l'historique existant reste lisible tel quel.
--  * Les bassins restent dans `sites.bassins` (jsonb) ; la position sur le plan y est ajoutée (plan_doc, plan_x, plan_y).
--  * Catalogue des points : `inspection_points`, amorcé avec les 23 points actuels de `types_bassin.checks`.
--  * Portail client : toutes les tables `client_*` et `documents` ont la RLS active et AUCUNE politique pour anon :
--    seule la fonction serveur `portail` (clé service) les lit et les écrit, après vérification de session.

-- 1) Visites : états des points, statut, source, résumé
alter table public.releves add column if not exists points jsonb;          -- { "<point_id>": { etat, note, valeur, photos[], wo_id, action } }
alter table public.releves add column if not exists actions jsonb;         -- { "<clé paramètre eau>": "Chloration choc" }
alter table public.releves add column if not exists statut text default 'publiee';  -- brouillon | publiee
alter table public.releves add column if not exists source text default 'terrain';  -- terrain | bureau
alter table public.releves add column if not exists saisi_par text;        -- compte qui a saisi au bureau (journalisé)
alter table public.releves add column if not exists source_detail text;    -- « Relevé transmis par téléphone », « Correction »…
alter table public.releves add column if not exists resume text;           -- résumé automatique au moment de la validation
alter table public.releves add column if not exists publiee_le timestamptz;
alter table public.releves add column if not exists envoyee_le timestamptz; -- « Envoyer au client »

-- 2) Catalogue des points de contrôle
create table if not exists public.inspection_points (
  id text primary key,
  systeme_code text not null check (systeme_code in ('eau','dosage','circulation','chauffage','securite','structure')),
  type_code text,                 -- null = tous les types de bassin
  libelle text not null,
  mode text not null default 'etat' check (mode in ('etat','ouinon','mesure')),
  unite text,
  obligatoire boolean not null default false,
  actions_correctives jsonb not null default '[]'::jsonb,
  ordre integer not null default 0,
  actif boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.inspection_points enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='inspection_points' and policyname='ip_select') then
    create policy ip_select on public.inspection_points for select to anon using (true);
    create policy ip_insert on public.inspection_points for insert to anon with check (true);
    create policy ip_update on public.inspection_points for update to anon using (true) with check (true);
  end if;
end $$;

-- Amorçage : les 23 points actuels de types_bassin.checks, répartis dans les systèmes (même règle que src/inspection/model.js).
insert into public.inspection_points (id, systeme_code, type_code, libelle, mode, obligatoire, ordre)
select t.code || '-' || (c.ord - 1),
  case
    when c.lib ~* '(registre|clôture|portail|échelle|main courante|premiers soins|drain|grille|profondeur|arrêt d.urgence|saillante)' then 'securite'
    when c.lib ~* '(écumoire|filtre|préfiltre|pompe|bouton|détecteur|jets)' then 'circulation'
    when c.lib ~* '(dos|chlorat|réservoir|injection)' then 'dosage'
    when c.lib ~* '(chauff|ventil|échangeur|thermo)' then 'chauffage'
    else 'structure' end,
  t.code, c.lib,
  case when c.lib ~* '(registre|clôture|portail|échelle|main courante|premiers soins|drain|grille|profondeur|arrêt d.urgence|saillante)' then 'ouinon' else 'etat' end,
  c.lib ~* '(registre|clôture|portail|échelle|main courante|premiers soins|drain|grille|profondeur|arrêt d.urgence|saillante)',
  c.ord
from public.types_bassin t, jsonb_array_elements_text(coalesce(t.checks, '[]'::jsonb)) with ordinality as c(lib, ord)
on conflict (id) do nothing;

-- 3) Portail client — comptes clients (organisation), contacts, QR, codes, sessions, journal, documents
create table if not exists public.client_comptes (
  id text primary key,
  nom text not null,
  logo_path text,                 -- bucket privé « portail »
  sites jsonb not null default '[]'::jsonb,   -- ids des sites de ce client
  niveaux jsonb not null default '{}'::jsonb, -- { operateur: {etat:true,...}, gestionnaire: {...}, direction: {...} }
  updated_at timestamptz not null default now()
);
create table if not exists public.client_contacts (
  id text primary key,
  compte_id text not null references public.client_comptes(id) on delete cascade,
  nom text not null,
  courriel text,
  cellulaire text,
  niveau text not null default 'operateur' check (niveau in ('operateur','gestionnaire','direction')),
  sites jsonb,                    -- null = tous les sites du compte
  actif boolean not null default true,
  dernier_acces timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists client_contacts_courriel on public.client_contacts (lower(courriel)) where courriel is not null and actif;
create table if not exists public.client_qr (
  id text primary key,
  site_id text not null,
  bassin_id text,
  jeton text not null unique,     -- ≥ 128 bits aléatoires (base64url)
  code_affiche text not null,     -- ex. SA-S08-B1
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  revoque_le timestamptz
);
create table if not exists public.client_otp (
  id bigint generated always as identity primary key,
  contact_id text not null,
  code_hash text not null,
  expire_le timestamptz not null,
  tentatives integer not null default 0,
  utilise boolean not null default false,
  ip_hash text,
  cree_le timestamptz not null default now()
);
create index if not exists client_otp_contact on public.client_otp (contact_id, cree_le desc);
create table if not exists public.client_sessions (
  id bigint generated always as identity primary key,
  genre text not null default 'client' check (genre in ('client','admin')),
  contact_id text,                -- client : client_contacts.id ; admin : comptes.id
  role text,                      -- admin : rôle du compte sa-admin (admin | superviseur)
  jeton_hash text not null unique,
  appareil_hash text,
  expire_le timestamptz not null,
  revoque boolean not null default false,
  cree_le timestamptz not null default now()
);
create table if not exists public.client_acces_journal (
  id bigint generated always as identity primary key,
  quand timestamptz not null default now(),
  contact_id text,
  identifiant text,               -- masqué (j•••@domaine)
  qr_id text,
  compte_id text,
  action text,
  resultat text not null,         -- ok | refuse | otp_echoue | otp_envoye | revoque
  ip_hash text,
  user_agent text
);
create index if not exists client_acces_journal_quand on public.client_acces_journal (quand desc);
create table if not exists public.documents (
  id text primary key,
  portee text not null check (portee in ('client','site','bassin')),
  compte_id text,
  site_id text,
  bassin_id text,
  titre text not null,
  type text not null default 'autre' check (type in ('plan','contrat','fiche','rapport','autre')),
  niveau_plan text,               -- ex. « Salle mécanique »
  storage_path text not null,
  mime text,
  taille integer,
  visibilite text not null default 'interne' check (visibilite in ('interne','operateur','gestionnaire','direction')),
  updated_at timestamptz not null default now()
);
alter table public.client_comptes enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_qr enable row level security;
alter table public.client_otp enable row level security;
alter table public.client_sessions enable row level security;
alter table public.client_acces_journal enable row level security;
alter table public.documents enable row level security;
-- (aucune politique : illisibles et non modifiables avec la clé publique — voulu, §9 de la passation)
revoke all on public.client_comptes, public.client_contacts, public.client_qr, public.client_otp, public.client_sessions,
  public.client_acces_journal, public.documents from anon, authenticated;

-- 4) Stockage privé (plans, logos, photos, PDF) : servi uniquement par URL signées courtes depuis la fonction `portail`
insert into storage.buckets (id, name, public) values ('portail', 'portail', false) on conflict (id) do nothing;

notify pgrst, 'reload schema';
