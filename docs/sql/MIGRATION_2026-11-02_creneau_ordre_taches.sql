-- 02/11/2026 — Créneau horaire et ordre d'exécution sur tous les travaux (bons de travail, créneaux, tâches planning).
-- Demande de Charles : le superviseur saisit l'heure de début, l'heure de fin et l'ordre (1, 2, 3…) ;
-- la tournée du technicien (sa-terrain) suit cet ordre, puis l'heure.
-- Aucune nouvelle table : colonnes ajoutées seulement (droits et politiques existants inchangés). Idempotent.
-- Heures en texte « HH:MM », comme plan.heure et planning_tasks.heure_debut / heure_fin.
-- ORDRE : appliquer ce fichier AVANT de déployer sa-admin / sa-terrain (les apps lisent et écrivent ces colonnes).
begin;
alter table public.workorders     add column if not exists heure_debut text;
alter table public.workorders     add column if not exists heure_fin   text;
alter table public.workorders     add column if not exists ordre       integer;
alter table public.plan           add column if not exists heure_fin   text;   -- plan.heure reste l'heure de début
alter table public.plan           add column if not exists ordre       integer;
alter table public.planning_tasks add column if not exists ordre       integer;
commit;

-- Retour arrière (perd les heures et ordres saisis) :
-- begin;
-- alter table public.workorders drop column if exists heure_debut, drop column if exists heure_fin, drop column if exists ordre;
-- alter table public.plan drop column if exists heure_fin, drop column if exists ordre;
-- alter table public.planning_tasks drop column if exists ordre;
-- commit;
