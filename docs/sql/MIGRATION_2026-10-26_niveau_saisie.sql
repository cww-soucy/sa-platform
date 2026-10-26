-- 26/10/2026 — Portail client : 4e niveau d'accès « saisie » (employé du client qui saisit les tests d'eau).
-- Aucune nouvelle table : seule la contrainte de client_contacts.niveau change. Idempotent.
-- Les tests saisis vont dans public.releves (statut « client », source « client ») par la fonction serveur « portail »
-- (action saisir_releve, clé service) : aucun nouveau droit pour anon ni authenticated.
-- Ordre : déployer d'abord la fonction « portail » (elle comprend le niveau « saisie »), puis appliquer ce fichier.
begin;
alter table public.client_contacts drop constraint if exists client_contacts_niveau_check;
alter table public.client_contacts add constraint client_contacts_niveau_check
  check (niveau in ('operateur', 'gestionnaire', 'direction', 'saisie'));
commit;
