-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-11-19 — AUCUN PRIX DANS LES APPS (directive de la direction)
-- Vide les données tarifaires de la base et empêche d'en réécrire :
--   • facturation.prix_calcule / prix_facture  → vidés (null) ; contrainte : doivent rester vides
--   • inventaire.prix                          → vidé (null), plus de valeur par défaut ; contrainte : vide ou 0
--   • histo_modifs (historique des modifications) : les prix des anciennes versions de ces lignes sont retirés
-- Le suivi des dossiers de facturation (ODT, PO, client, date, statut) est conservé.
-- Les apps (sa-admin, sa-terrain, portail) n'affichent ni n'exportent déjà plus aucun prix, avec ou sans cette migration.
--
-- ⚠ DESTRUCTIF : les prix effacés ne reviennent pas. Faire d'abord une copie si la direction veut garder une archive
--   hors application (voir « Copie avant » ci-dessous). Les sauvegardes automatiques de Supabase en gardent une trace
--   jusqu'à leur expiration (7 jours sur le forfait Pro).
-- À appliquer dans le SQL Editor de Supabase, d'un seul bloc (tout ou rien).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- Copie avant (facultatif, à exécuter seule et à enregistrer en CSV depuis le SQL Editor) :
-- select id, id_projet, client, odt, po, prix_calcule, prix_facture from public.facturation where prix_calcule is not null or prix_facture is not null;
-- select id, nom, prix from public.inventaire where coalesce(prix, 0) <> 0;

begin;

-- 1. Facturation : prix vidés (le déclencheur d'historique copie l'ancienne ligne ; on nettoie l'historique à l'étape 3)
update public.facturation set prix_calcule = null, prix_facture = null
 where prix_calcule is not null or prix_facture is not null;

-- 2. Stock : prix vidés, plus de valeur par défaut
update public.inventaire set prix = null where prix is not null;
alter table public.inventaire alter column prix drop default;

-- 3. Historique des modifications : retirer les prix des anciennes versions
update public.histo_modifs set row_data = row_data - 'prix_calcule' - 'prix_facture'
 where tbl = 'facturation' and (row_data ? 'prix_calcule' or row_data ? 'prix_facture');
update public.histo_modifs set row_data = row_data - 'prix'
 where tbl = 'inventaire' and row_data ? 'prix';

-- 4. Garde-fous : la base refuse désormais tout prix (une ancienne version de l'app ouverte sur un poste envoie au plus 0)
alter table public.facturation drop constraint if exists facturation_sans_prix;
alter table public.facturation add constraint facturation_sans_prix check (prix_calcule is null and prix_facture is null);
alter table public.inventaire drop constraint if exists inventaire_sans_prix;
alter table public.inventaire add constraint inventaire_sans_prix check (coalesce(prix, 0) = 0);

commit;

-- Vérification (doit répondre : 0 | 0 | 0)
-- select (select count(*) from public.facturation where prix_calcule is not null or prix_facture is not null),
--        (select count(*) from public.inventaire where coalesce(prix, 0) <> 0),
--        (select count(*) from public.histo_modifs where (tbl = 'facturation' and (row_data ? 'prix_calcule' or row_data ? 'prix_facture')) or (tbl = 'inventaire' and row_data ? 'prix'));

-- ── Retour arrière ─────────────────────────────────────────────────────────────────────────────
-- Les prix effacés ne peuvent pas être restaurés (sauf depuis la copie CSV ou une sauvegarde Supabase).
-- Pour seulement réautoriser la saisie de prix :
-- alter table public.facturation drop constraint if exists facturation_sans_prix;
-- alter table public.inventaire drop constraint if exists inventaire_sans_prix;
-- alter table public.inventaire alter column prix set default 0;
