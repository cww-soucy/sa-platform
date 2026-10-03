# Handoff : SA Platform → `sa-terrain` + `sa-admin`

## Overview
Soucy Aquatik (services aquatiques, Québec) scinde son app de production SA Platform / SOUCY OPS (1 fichier HTML de 13 700 lignes) en deux applications sur la **même base Supabase** :
- **`sa-terrain`** — app iPhone du technicien, « La Tournée » : compagnon de visite site par site. Le contenu change selon le site punché ; la fiche technique est **générée à partir des paramètres du contrat/bassin**, jamais codée en dur.
- **`sa-admin`** — plateforme desktop : centre de monitoring technique et opérationnel (10 modules + carte).

## About the Design Files
Les fichiers de ce paquet sont des **références de design en HTML** (prototypes montrant l'apparence et le comportement voulus), pas du code de production à copier. La tâche est de **recréer ces designs dans l'environnement cible**. Contraintes non négociables du client :
- **Un seul fichier HTML autonome par app** — CSS + JS inclus, **aucun framework, aucun build step** (vanilla JS, `<template>`/DOM API ou mini-rendu maison).
- Polices via Google Fonts `<link>` uniquement.
- **PWA hors-ligne** (service worker + manifest ; cache des sites/contrats/tournée 7 jours ; file d'attente des fiches à synchroniser).
- **Système de tokens en variables CSS** (voir plus bas) — aucun style figé par écran.
- Logo existant (carré `#004987`, mot-mark « Soucy Aquatik » blanc) à utiliser tel quel — le prototype l'imite en texte, **remplacer par le vrai fichier SVG/PNG**.
- **Aucune modification de la logique métier.** Temps / Suivi / Cumul : habillage visuel seulement — brancher l'affichage sur les fonctions de calcul existantes, sans les réécrire.

Les prototypes sont des « Design Components » (`.dc.html`) : le markup est dans `<x-dc>…</x-dc>`, la logique dans la classe `Component` (`renderVals()` = toutes les valeurs dérivées ; c'est la meilleure spec du comportement). `support.js` est le runtime du prototype — **ne pas l'embarquer en production**.

## Fidelity
**Haute fidélité.** Couleurs, typo, espacements, états et interactions sont finaux. Recréer fidèlement.

## Direction visuelle (système « Industry »)
Plan technique / blueprint : fond clair, encre quasi noire, **un seul accent acier**. Objets « fil de fer » : coins carrés (radius 0), filets 1px, **marques de repérage « + »** aux 4 coins des cartes/panneaux/bouton primaire. Pas de fond plein sur les cartes (transparentes). Le bouton primaire est le seul objet plein. Grilles visibles (cellules séparées par des filets 1px, souvent via `gap:1px` sur fond `--color-divider`). **Pas de dégradés, pas d'étiquettes ALL-CAPS, pas d'emoji.**

**Langage d'état monochrome** (aucune couleur rouge/verte) :
- Dans la zone : contour accent + icône check.
- À saisir / en attente : contour pointillé.
- À surveiller : hachures diagonales (`repeating-linear-gradient(135deg, ink 0 1px, transparent 1px 3–4px)`).
- **Hors zone / alerte : bloc plein `--color-accent-900` (#1d2d3d), texte blanc + icône alerte.** Très lisible au soleil.

Coins de repérage : `.blueprint{position:relative;border:1px solid var(--color-divider)}` + 4 `<i class="corner tl|tr|bl|br">` de 11×11px, positionnés à −6px, croix 1px `color-mix(in srgb, var(--color-text) 55%, transparent)` (voir `ds/styles.css`).

## Design Tokens (copier `ds/styles.css` `:root`)
- `--color-bg #f2f2f3` · `--color-surface #e9e9ea` · `--color-text #1d1f20` · `--color-accent #5980a6` · `--color-divider = color-mix(#1d1f20 16%, transparent)`
- Accent 100→900 : `#eef6ff #d6ebff #b5d9fd #94bce3 #749dc4 #597ea3 #416180 #2c455d #1d2d3d`
- Neutre 100→900 : `#f5f5f8 #e7e7ea #d4d4d7 #b7b7ba #98989b #7a7a7d #5d5d60 #424244 #2b2b2d`
- Marque (logo uniquement) : `#004987`
- Polices : titres **Barlow Condensed 600** (`--font-heading`), texte **Barlow 400/500/700** (`--font-body`). Letter-spacing titres −0.015em.
- Espacements : `--space-1..8` = 3.4 / 6.8 / 10.2 / 13.6 / 20.4 / 27.2px. Radius effectif 0 sur cartes/boutons/champs.
- Ombres : `--shadow-sm/md/lg` (toast, menus, dialog uniquement).
- Focus : `outline 2px solid var(--color-accent); offset 2px`. Hover : tint `--color-accent-100`. Pressed : `--color-accent-200` (steppers) / `-600` (primaire).
- Icônes : **Lucide, stroke 1.5** (inline SVG `currentColor`). Liste utilisée dans `sa-icons.js`.
- Tokens applicatifs ajoutés : `--sa-row` (padding vertical des cellules admin : 10px confortable / 5px compacte).

### Mode plein soleil (sa-terrain) — surcharge de tokens sur la racine de l'app
`--color-bg #fff · --color-text #000 · --color-divider rgba(0,0,0,.6) · --color-accent #1d2d3d · --color-accent-600 #000 · -700 #1d2d3d · -800 #000 · -200 #94bce3 · -300 #416180 · --color-neutral-500 #6a6a6d · -600 #3a3a3c · -700 #2b2b2d` + `font-weight:500` global. Bascule manuelle (bouton soleil 48px dans l'en-tête + Profil), à persister (localStorage). « Texte agrandi » = `zoom:1.12` sur la zone de contenu.

---

## sa-terrain (iPhone, 402×874 de référence)
Structure : en-tête fixe (logo 46px, titre écran 18px, « Hors-ligne prêt · synchro HH:MM », bouton soleil 48×48) · contenu défilant · barre d'onglets fixe 5 onglets (Aujourd'hui, Fiche, Planning, Demandes, Profil), 62px + 26px zone home, onglet actif = encre + barre intérieure 3px en haut, point carré accent sur « Fiche » si punché. Corps 17px min, cibles tactiles ≥ 48px (steppers 58px, boutons primaires 58–60px).

1. **Aujourd'hui** — date H1 38px ; bloc punch (blueprint) : « Punché depuis 08:24 » + durée, nom du site 30px, type · ville, 3 cellules (relevés / saisis / hors zone), « Ouvrir la fiche technique » (primaire 58px), « Dépunch ». Sans punch : prochain arrêt + « Punch sur ce site ». **Tournée** en ligne de transport verticale (nœuds carrés 31px : fait = plein accent-700 + check, en cours = encre + carré blanc, à venir = contour) ; bouton « Punch » 64×48 sur les arrêts à venir. Grille 2×2 d'accès rapides : Logistique, Hivernage (x/33), Demande, Appeler le bureau (`tel:`).
2. **Fiche technique adaptative (cœur)** — en-tête site + tags « Contrat X » / norme ; bandeau 3 cellules (saisis x/n, hors zone — cellule pleine accent-900 si >0, vérifs). Sections générées depuis `TYPES[site.type]` :
   - **Relevés** (`kind:'range'`) : libellé + chip d'état ; valeur 52px condensée (grise tant que non saisie) + unité ; boutons − / + 58×58 (pas = `step`) ; **règle graduée** 44px : bords 1px, graduations tous les 10 %, **zone du contrat hachurée** (accent-100 + hachures accent-300, bords accent-700), aiguille 3px encre + tête 13×9 ; toucher/glisser la règle fixe la valeur (pointer events, `touch-action:none`) ; libellés min / lo / hi / max ; « Dernier relevé : v · date ». Chip hors zone : « Bas · viser lo – hi » / « Élevé · viser … ».
   - `kind:'count'` (jets inopérants, jours depuis vidange) : stepper sans règle + « Zone du contrat : … ».
   - **Vérifications** : lignes 60px, case 32px (pleine encre + check si cochée).
   - **Produits ajoutés** : stepper 52px par produit du contrat (pas propre au produit).
   - **Photo** (cadre blueprint 150px, requise, géolocalisée) + note.
   - Pied collant : avertissement « n valeur(s) hors zone — le bureau sera avisé » + « Valider la fiche » ; après validation : confirmation + « Dépunch ».
   - Les 6 types démontrés (MI, ME, RE, JE, SP, PA) avec leurs champs, zones, vérifs, produits : **voir `sa-data.js` → `TYPES`**. En production ces définitions viennent des tables contrat/bassin Supabase.
3. **Logistique** — onglets Sortie d'inventaire (stock camion, stepper, destination = site punché) / Bon de livraison (BL, articles sortis, nom du signataire, **signature canvas au doigt**, Effacer / Confirmer).
4. **Hivernage** — compteur x/33, **grille 11×3 de cellules** (plein = fait, hachuré = cette semaine, contour = à planifier), filtre À faire/Faits/Tous, liste ; rapport : 7 étapes cochables, antigel (L), état général (Bon / À surveiller / Réparation requise), notes, « Envoyer le rapport ».
5. **Demandes** — tuiles Matériel, Renfort, **Urgence (pleine accent-900)**, Appeler le bureau ; composeur : chips de motif 46px, détails, site joint auto, Envoyer ; historique avec statut.
6. **Planning** — bandeau de jours 62×66 ; liste du jour ; badge récurrence (icône repeat + « Tous les jeudis ») ; section « Mes visites récurrentes » (aucune recherche nécessaire).
7. **Profil** — heures semaine / banque (lecture seule), camion, tel, données hors-ligne, interrupteurs Plein soleil / Texte agrandi, déconnexion.

Toast : bandeau encre bas d'écran, 2,6 s.

## sa-admin (desktop, conçu pour 1440–1920px, fluide dès ~900px)
Grille : rail gauche 236px (logo, groupes Terrain / Gestion / Équipe, item actif = barre gauche 3px encre + fond accent-100, badges carrés : alerte = plein encre) · en-tête 68px (H1 30px + sous-titre, recherche globale sites/dossiers/ODT avec menu de résultats, « En direct · date · heure ») · contenu défilant, padding 24/28px.

1. **Monitoring** — plaque KPI (cellules auto-fit ≥170px ; KPI d'alerte en plein accent-900) ; « Équipe en ce moment » (tableau : technicien, statut, site, depuis, dernière activité ; clic → Inspections du site) ; « Flux terrain » (heure, icône, texte, alertes en plein) ; **Salles mécaniques** (grille ≥230px ; pompe / filtration / dosage avec pastille carrée : contour / hachures / plein ; en-tête plein si alerte, trié par gravité) ; « Relevés hors zone ».
2. **Carte des sites** — bascule Géographique (Leaflet + tuiles OSM en niveaux de gris, marqueurs carrés, techniciens = carrés encre avec initiales, popups ; liste latérale 300px) / **Schéma des tournées** (une ligne de transport horizontale par technicien, arrêts carrés, arrêt courant 22px avec double anneau, progression en trait encre). ⚠ Hors-ligne : prévoir un repli (schéma) si tuiles indisponibles ; OSM exige l'attribution et un referrer.
3. **Inspections & rapports** — liste de sites filtrable par type (badge n hors zone) ; en-tête site ; onglets par paramètre du contrat ; 5 stats (dernier, moyenne 30 j, min/max, % dans la zone, jours hors zone) ; **graphique 30 jours** : zone du contrat hachurée, ligne 2px, points (hors zone = pleins et plus gros), graduations Y min/lo/hi/max ; tableau des 10 dernières visites (cellules hors zone pleines) ; export.
4. **Opérations** — filtres par statut ; **une ligne par dossier client** (jamais une fiche par visite) : n° dossier, client + objet + « n visites regroupées », responsable, barre d'avancement faits/total, statut ; accordéon : tableau des visites, sites du contrat, « Planifier une visite », « Facturation ».
5. **Planning équipe** — grille techniciens × jours (jour courant en surbrillance) ; créneaux (heure, tâche, site, icône série) ; clic sur une cellule vide = pré-remplit ; **dialog Nouveau créneau** : type (Bon de travail / Créneau / Tâche), site, technicien, date, heure, répétition (Une fois / Chaque semaine / Aux 2 semaines), jours L–D, jusqu'au → **aperçu en direct du nombre d'occurrences et des dates** ; création de la série. Algorithme : `occurrences()` dans le JS.
6. **Sites** — cartes « Détectés automatiquement » (source : punch GPS / bon de livraison) : nouveau → Créer / Associer / Ignorer ; doublon probable → comparaison Détecté vs Existant (nom, GPS, distance) → Fusionner (historique conservé) / Garder séparé / Ignorer ; répertoire filtrable.
7. **Facturation** (remplace l'Excel) — plaque : à facturer, facturé non payé, payé, écart cumulé ; filtres statut ; tableau ODT, PO (« PO manquant » en pointillé), client · site, date, prix calculé, prix facturé, **écart** (négatif = plein accent-900, positif = accent-100), statut cliquable À facturer → Facturé → Payé ; totaux ; export .xlsx mêmes colonnes que l'ancien fichier.
8. **Sondages clients** — liste ; résultats : KPI, **barres empilées 1–5 sur la rampe accent 100/300/500/700/900**, moyenne par question, verbatims ; constructeur : titre, destinataires, questions (échelle 1–5, oui/non, choix multiple, texte libre), ajouter/retirer, envoyer.
9. **Communication** — statistiques du département (7 cellules) ; éditeur d'infolettre (mot de la semaine, rappel sécurité, heures par technicien) + **aperçu courriel en direct** ; envoyer / test.
10. **Temps · Suivi · Cumul** — onglets ; mention « Valeurs produites par le calcul existant — affichage seulement » ; Temps (heures/jour, total) ; Suivi (punchs à valider avec motif : dépunch auto, hors géorepérage, pause non saisie → Corriger ouvre l'éditeur existant / Valider) ; Cumul (semaine, saison, banque, heures sup.).

## State Management (minimum)
Terrain : `screen`, `punched` (job id + heure), statut par job, par site `{vals, touched, checks, prods, photo, validated}`, sortie inventaire, signature, hivernage (checks, antigel, état, faits), demandes envoyées, jour de planning, `sun`, `big`. **Tout est écrit d'abord en local (IndexedDB) puis synchronisé** ; afficher l'état de synchro.
Admin : module actif, recherche, filtres par module, site/paramètre d'inspection, dossiers ouverts, formulaire de série, statuts de facture, sondage sélectionné/brouillon, infolettre, validations de punch. Monitoring = abonnement temps réel Supabase (punchs, relevés, alertes).

## Données
`sa-data.js` = jeu de données fictif mais réaliste (22 sites en Estrie / Centre-du-Québec avec GPS réels des villes, 8 techniciens, tournée du 1er oct. 2026, 30 jours d'historique généré, 33 sites d'hivernage, dossiers, factures, sondages, temps). Il documente aussi la **forme** attendue des données (types de bassin → champs/zones/vérifs/produits ; salles mécaniques ; dossiers → visites).

## Files
- `SA Terrain.dc.html` — prototype sa-terrain (template + logique)
- `SA Admin.dc.html` — prototype sa-admin
- `SA Carte.html` — carte Leaflet (vue géographique de l'admin)
- `sa-data.js` — données + définitions de contrats/bassins
- `sa-icons.js` — icônes Lucide (web component `<sa-i n s w>`)
- `ios-frame.jsx` — cadre iPhone du prototype (présentation seulement)
- `ds/styles.css` — tokens + classes du système Industry
