-- 2026-09-29 — Outils : colonnes manquantes (APPLIQUÉ en production)
-- SA Platform (v61+) envoie `emplacement` et `photos` avec chaque outil, mais la table ne les avait pas :
-- le serveur rejetait donc TOUTES les fiches outils (0 ligne dans `outils` au 29/09), elles ne restaient
-- que dans le téléphone qui les avait créées. Ajout purement additif, testé à blanc avec le rôle anon.
alter table public.outils add column if not exists emplacement text, add column if not exists photos jsonb;
notify pgrst, 'reload schema';
