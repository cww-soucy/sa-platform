-- 2026-10-22 — Portail client : un même courriel peut être contact de plusieurs comptes clients
-- (ex. un gestionnaire de plusieurs immeubles, ou le personnel de Soucy Aquatik). Le portail lui demande alors quelle
-- installation ouvrir ; chaque installation garde le niveau et les sites du compte qui la donne.
-- Avant : un courriel actif = un seul contact dans toute la table. Après : un courriel actif = un contact par compte.
-- Aucune donnée modifiée. À lancer une fois, avant de déployer la fonction « portail » de cette version.
begin;
drop index if exists public.client_contacts_courriel;
create unique index if not exists client_contacts_compte_courriel on public.client_contacts (compte_id, lower(courriel))
  where courriel is not null and actif;
commit;
