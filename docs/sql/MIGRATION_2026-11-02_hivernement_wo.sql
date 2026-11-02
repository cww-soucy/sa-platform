-- 02/11/2026 — Type de job « Hivernement » (sa-admin › bon de travail).
-- Un bon de travail « Hivernement » porte le numéro d'ODT saisi à la main et crée la cédule d'hivernement du site :
-- une liste « Hivernement » dans rapports_hivernage (status 'planifie'), liée au bon par wo_id et odt.
-- Aucune nouvelle table : deux tables existantes reçoivent des colonnes nullable (droits et RLS inchangés). Idempotent.
-- Avant ce fichier, l'application fonctionne déjà : l'ODT est alors écrit en tête de la description du bon,
-- et la cédule est créée sans lien wo_id (elle ne suivra pas les changements de date du bon).
begin;
alter table public.workorders add column if not exists odt text;
alter table public.rapports_hivernage add column if not exists wo_id text;
alter table public.rapports_hivernage add column if not exists odt text;
create index if not exists rapports_hivernage_wo_id_idx on public.rapports_hivernage (wo_id);
commit;
