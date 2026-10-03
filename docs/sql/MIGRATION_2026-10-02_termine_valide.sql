-- 2026-10-02 — « Marquer terminé » / « Valider » (APPLIQUÉ en production, testé à blanc)
-- SA Platform pose termine / termineBy / termineAt / valide / valideBy / valideAt sur les bons de travail, créneaux
-- et tâches planning, mais ces colonnes n'existaient pas : le serveur refusait alors TOUTE la fiche (et ses
-- modifications suivantes), qui restait bloquée sur l'appareil. Colonnes ajoutées ; index.html (sw v79) convertit
-- désormais termineBy → termine_by, etc. sa-admin s'en sert pour la file « à valider ».
alter table public.workorders add column if not exists termine boolean, add column if not exists termine_by text, add column if not exists termine_at timestamptz, add column if not exists valide boolean, add column if not exists valide_by text, add column if not exists valide_at timestamptz;
alter table public.plan add column if not exists termine boolean, add column if not exists termine_by text, add column if not exists termine_at timestamptz, add column if not exists valide boolean, add column if not exists valide_by text, add column if not exists valide_at timestamptz;
alter table public.planning_tasks add column if not exists termine boolean, add column if not exists termine_by text, add column if not exists termine_at timestamptz, add column if not exists valide boolean, add column if not exists valide_by text, add column if not exists valide_at timestamptz;
notify pgrst, 'reload schema';

-- Sites créés automatiquement (punch, créneau, planning) : SA Platform pose aValider / creePar / creeLe, sans colonne
-- au serveur → un tel site était refusé (et tout envoi groupé de la liste des sites avec lui). Colonnes ajoutées,
-- index.html (v79) convertit aValider ↔ a_valider, creePar ↔ cree_par, creeLe ↔ cree_le.
alter table public.sites add column if not exists a_valider boolean, add column if not exists cree_par text, add column if not exists cree_le timestamptz;
notify pgrst, 'reload schema';
