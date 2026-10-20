# Migrations SQL — règles du dépôt

Les fichiers de ce dossier sont appliqués **à la main** dans le SQL Editor de Supabase (projet `ldqvdiaewvhnukuaxdmc`),
jamais automatiquement. Un fichier = une migration datée : `MIGRATION_AAAA-MM-JJ_sujet.sql`, avec une section
« retour arrière » en commentaire à la fin.

## Nouvelle table : droits explicites obligatoires (Supabase, à partir du 30/10/2026)

Depuis le 30/10/2026, Supabase ne donne plus **aucun droit automatique** sur une table créée dans `public`
(ni `anon`, ni `authenticated`, ni `service_role`). Sans `grant`, supabase-js / PostgREST répondent
« permission denied » — même pour l'admin connecté et pour les fonctions serveur. Les tables existantes ne sont pas touchées.
C'est aussi vrai pour une table recréée (`drop` + `create`) : elle perd ses droits.

Donc, **dans la même migration que le `create table`** :

```sql
create table if not exists public.ma_table (
  id text primary key,
  -- …
  updated_at timestamptz not null default now()
);
alter table public.ma_table enable row level security;

-- Droits : connecté et fonctions serveur. PAS anon, sauf table publique voulue (carnet QR, sondages clients).
grant select, insert, update, delete on public.ma_table to authenticated;
grant select, insert, update, delete on public.ma_table to service_role;
-- colonne « bigint generated … as identity » ou « serial » : rien de plus ; séquence « nextval » explicite :
-- grant usage on sequence public.ma_table_id_seq to authenticated, service_role;

-- Politiques : toujours « to authenticated » (jamais « to anon » seul, voir l'incident du 20/10/2026 ci-dessous),
-- avec les fonctions de SECURISATION_ETAPE3_PREPARATION.sql :
create policy ma_table_lecture on public.ma_table for select to authenticated
  using ((select public.sa_role()) is not null);
create policy ma_table_ecriture on public.ma_table for all to authenticated
  using ((select public.sa_role()) in ('admin','superviseur'))
  with check ((select public.sa_role()) in ('admin','superviseur'));
```

- `sa_compte()` : identifiant SA du jeton ; `sa_role()` : rôle actuel (null si compte inactif ou sans jeton).
- « Ses propres lignes » : `using (uid = (select public.sa_compte()) or (select public.sa_role()) in ('admin','superviseur'))`.
- Une table **publique** (page sans connexion) : ajouter `grant select[, insert] … to anon` **et** une politique `to anon`
  — et l'ajouter à la liste des exceptions publiques de `SECURISATION_ETAPE3.sql`.
- Nouvelle **fonction** : `revoke execute … from public, anon;` puis `grant execute … to authenticated, service_role;`
  (et `to anon` seulement si elle sert à une page publique, comme `verifier_connexion`).
- Ajouter la table à `tests/schema.json` (colonnes acceptées par la fausse base des tests) et, si l'app la lit,
  vérifier la lecture **avec jeton** dans `tests/securite-sql.test.js`.

`tests/migrations-droits.test.js` refuse une migration de ce dossier qui crée une table sans RLS ni `grant` à
`authenticated` et `service_role` (les fichiers d'avant le 20/10/2026 sont exemptés).

## Incident du 20/10/2026 — à ne pas reproduire

Des politiques écrites `to anon` seulement ne s'appliquent pas aux sessions avec jeton (rôle `authenticated`) :
sa-admin connecté ne voyait plus relevés, bons de travail, demandes… Corrigé par
`CORRECTIF_2026-10-20_politiques_connectes.sql`. Toute politique d'une table lue par les apps vise `authenticated`.
