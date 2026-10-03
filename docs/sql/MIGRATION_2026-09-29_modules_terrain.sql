-- ═══════════════════════════════════════════════════════════════════════════
-- Modules sa-terrain (logistique, hivernage, photo de demande) — APPLIQUÉ en production le 2026-09-29.
-- Ajouts seulement : aucune colonne retirée ni modifiée.
-- ═══════════════════════════════════════════════════════════════════════════

-- Photo jointe à une demande du terrain (JPEG compressé, data URL ~60-120 Ko).
alter table public.demandes add column if not exists photo text;
-- Indicateur léger pour les listes de sa-admin : la photo n'est chargée qu'à l'ouverture.
alter table public.demandes add column if not exists has_photo boolean generated always as (photo is not null) stored;

-- index.html envoie le client d'une sortie d'inventaire ; la colonne manquait → chaque envoi était refusé.
alter table public.sorties_inventaire add column if not exists client text;
