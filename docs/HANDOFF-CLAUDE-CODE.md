# Passation — sa-terrain / sa-admin pour Soucy Aquatik

Ce document remplace toute explication orale. Tout ce qu'il faut pour continuer est ici ou dans les fichiers joints.

## 1. Contexte

Soucy Aquatik exploite **SA Platform** (`index.html`, ~13 700 lignes) en production sur `sa-platform.pages.dev` (Cloudflare Pages, déployé en poussant sur GitHub). C'est l'outil historique : punchs, WO, planning, temps, facturation approximative — tout dans un seul fichier vanilla JS.

Modernisation en cours : deux nouvelles apps, **même base Supabase**, construites aujourd'hui en une seule session de chat (pas Claude Code) à partir d'un design produit dans Claude Design :
- **`terrain.html`** → déployé à `sa-platform.pages.dev/terrain.html` — app iPhone du technicien
- **`admin.html`** → déployé à `sa-platform.pages.dev/admin.html` — plateforme de gestion desktop

**`index.html` continue de tourner sans interruption.** Rien n'a été retiré de la production. Les deux nouvelles apps lisent/écrivent la même base Supabase (projet `ldqvdiaewvhnukuaxdmc`), en ajoutant seulement de nouvelles tables — aucune table existante n'a été modifiée dans sa structure (des colonnes ont été ajoutées, jamais retirées).

## 2. Ce que l'utilisateur a dit après avoir essayé l'app

> « elle est géniale, mais les fonctionnalités sont moins avancées et fiables, ou pas finies d'être développées comparativement à index de SA Platform »

Puis, après un premier audit jugé incomplet :

> « la carte marche pas, pas de PDF/impression/email, pas d'intégration API, pas de gestion de comptes/paramètres »

C'est le mandat : **fiabiliser et compléter**, pas repartir de zéro. Le design (`ds/styles.css`, `sa-icons.js`) est validé et apprécié — n'y touchez pas sans raison.

**Leçon du premier audit, ratée : tout ce qui a été « vérifié » aujourd'hui l'a été en local (`file://`), jamais sur le vrai déploiement (`https://sa-platform.pages.dev`).** La carte fonctionnait dans tous les tests locaux et ne fonctionne pas en production — preuve que ces deux environnements ne se comportent pas pareil ici. **Avant de déclarer quoi que ce soit « fait » ou « fiable », le vérifier sur l'adresse réelle, pas seulement en local.**

## 3. Comment le code est construit — important à comprendre avant de toucher à quoi que ce soit

Il n'y a **pas de framework**. Le design a été produit par un outil interne (Claude Design) qui génère un gabarit dans une syntaxe `<sc-if>` / `<sc-for>` / `{{ expression }}` proche de JSX mais qui n'est PAS du HTML valide tel quel.

Pour obtenir un fichier HTML autonome (contrainte imposée : un seul fichier, pas de build step, pas de dépendance), un **mini-moteur de rendu maison** a été écrit (`terrain.runtime.js` / `admin.runtime.js`, ~40 lignes chacun) qui :
1. Convertit `<sc-if>`/`<sc-for>` en `<template data-sc="if|for">` (HTML valide, supporté nativement par tous les navigateurs)
2. Interprète `{{ chemin.vers.valeur }}` et les boucles à l'exécution, avec un algorithme de *morphing* DOM (comme React, mais fait main)

**Trois scripts Python (`*.assemble.py`) construisent les fichiers finaux :**
- Prennent le gabarit brut exporté de Claude Design (`SA Terrain.dc.html` / `SA Admin.dc.html`, dans `design_handoff_sa_platform/`)
- Appliquent des dizaines de petites substitutions regex pour : retirer les attributs de démonstration, convertir les styles `hover`/`active` en règles CSS, brancher les vrais libellés à la place des textes d'exemple, insérer des blocs qu'on a ajoutés (formulaires, dialogues)
- Concatènent gabarit + CSS + `runtime.js` + `app.js` (la logique) en un seul fichier HTML

**Pour modifier quelque chose :**
1. Éditer `terrain.app.js` ou `admin.app.js` (la logique — c'est ici que 95 % du travail se passe)
2. Si le gabarit HTML doit changer, éditer `terrain.assemble.py` ou `admin.assemble.py`
3. Lancer `python3 assemble.py` (dans le dossier correspondant) → régénère `sa-terrain.html` / `sa-admin.html`
4. **Toujours valider avec `node --check app.js` avant de lancer assemble.py**

**Piège déjà rencontré deux fois aujourd'hui**, à éviter :
- Une recherche regex non gourmande (`.*?`) sur un bloc contenant des blocs imbriqués (`sc-for` dans un `sc-if`) s'arrête au **premier** tag de fermeture trouvé, pas au bon. Utiliser systématiquement un compteur de profondeur (voir la fonction `block()` utilisée partout dans ce document et dans les scripts) — jamais de `.*?` sur du HTML imbriqué.
- Après une insertion de code Python via un remplacement de chaîne, si le script suivant plante avant le `open(...,'w').write(...)` final, **rien n'est sauvegardé** — toujours vérifier `grep` que le changement est bien présent dans le fichier après coup, pas seulement que le script n'a pas crashé.

## 4. Schéma Supabase — tables ajoutées aujourd'hui (rien de modifié, tout est additif)

| Table | Rôle | RLS |
|---|---|---|
| `types_bassin` | 7 types de bassin (valeurs par défaut du design, **jamais validées par l'utilisateur**) | select |
| `contrats` | 1 ligne par site, lie un site à un `type_code` | select/update/insert |
| `releves` | Relevés techniques saisis en tournée (sa-terrain écrit, sa-admin lit) | select/insert/update |
| `demandes` | Demandes de matériel/renfort/urgence | select/insert/update |
| `feuilles_temps_hist` / `histo_modifs` | Copie automatique de toute ligne modifiée/supprimée sur `feuilles_temps`, `workorders`, `plan`, `planning_tasks`, `sites`, `contrats`, `facturation` — **déclencheurs SQL, jamais désactivés** | select |
| `app_meta` | Un seul enregistrement `reset_epoch` (entier) — garde-fou anti-résurrection de données (voir §7) | select |
| `projets_excel` | 34 projets importés du fichier Excel de pilotage | select |
| `facturation` | 42 dossiers importés du fichier Excel (ODT, prix calculé/facturé, statut) | select/update |

**Politiques RLS ajoutées sur les tables existantes** (`workorders`, `planning_tasks`) : `wo_insert_fresh` / `pt_insert_fresh` refusent tout INSERT dont `created_at` est antérieur à `app_meta.created_cutoff` — c'est le garde-fou anti-doublon mis en place après l'incident de duplication de ce matin (voir §7 pour le contexte).

## 5. Sécurité — à lire avant de toucher à l'authentification

Les deux apps utilisent la **clé publique anon** de Supabase, en clair dans le fichier HTML (comme `index.html` le fait déjà). L'authentification passe par `rpc/verifier_connexion`, une fonction Postgres existante qui vérifie identifiant/mot de passe côté serveur. **Ce n'est pas un vrai système d'autorisation** : une fois connecté, n'importe quel rôle peut écrire n'importe où via l'API REST directement (même limite que SA Platform aujourd'hui — pas une régression, mais pas réglé non plus).

`sa-admin` vérifie `role==='admin'||'superviseur'` uniquement côté client, au login. **Un utilisateur qui contourne le login peut écrire directement via l'API REST publique.** Si ce risque est jugé important, la vraie solution est des Postgres Functions avec `security definer` qui vérifient le rôle serveur-side — pas fait aujourd'hui, faute de temps.

### Mise à jour du 29/09/2026 — `SECURISATION_ETAPE2.sql` (appliqué en production)

- **Constat :** l'étape 1 voulait rendre `comptes` illisible, mais l'ancienne politique `acces_equipe` (ALL, `true`) n'avait jamais été retirée. La table restait lisible et modifiable avec la clé publique : les 9 hachés `mdp_hash` étaient téléchargeables, et on pouvait y écrire un haché connu pour prendre un compte.
- **Correctif :** les hachés sont dans `comptes_secrets` (RLS sans politique, aucun droit pour anon). Un déclencheur vide `mdp`/`mdp_hash` à chaque écriture dans `comptes`. `verifier_connexion`, `changer_mdp` et `reinitialiser_mdp` lisent `comptes_secrets`, avec la même signature. Aucune app n'a été modifiée pour ça.
- **Vérifié en production :** 0 secret dans `comptes`, 9/9 hachés migrés, connexion OK, l'écriture d'un haché via l'API est sans effet, un vieux cache d'`index.html` n'annule plus un changement de mot de passe.
- **`index.html` :** le repli de connexion « local » est supprimé. Il acceptait `admin`/`admin1234` quand le serveur ne répondait pas.
- **Toujours ouvert (étape 3) :** la clé publique permet encore de modifier `role`/`droits` d'un compte ou d'en créer un. Il faut maintenant un vrai mot de passe pour en profiter, mais la vraie solution reste une authentification serveur (Supabase Auth, ou des fonctions `security definer` qui vérifient l'appelant).

## 6. Décision explicite de l'utilisateur, à respecter

> « les punchs à valider restent dans SA Platform... une fois validé... on aura juste une mise à jour à faire »

Puis, plus tard dans la même session, l'utilisateur a demandé la validation des punchs dans sa-admin quand même (« migration complète ») — **c'est fait** (`Comp.prototype.validerPunch` / `saveFix` dans `admin.app.js`, section Suivi). Les deux écritures (`writeFT` dans terrain, logique équivalente dans admin) relisent la ligne avant d'écrire et refusent d'écraser si `updated_at` a changé entre-temps (contrôle de concurrence optimiste, retry jusqu'à 5 fois).

## 7. Contexte de l'incident de ce matin (pour comprendre les garde-fous en place)

Une longue session de débogage a eu lieu ce matin : des doublons de WO/tâches créés en boucle. Cause racine identifiée après plusieurs fausses pistes : une routine existante dans `index.html` (`pushAllLocalToServer`, appelée automatiquement à chaque ouverture de l'app) repousse tout le cache local d'un appareil vers le serveur — utile pour récupérer du travail fait hors-ligne, mais elle ramenait aussi de vieilles données locales après un nettoyage serveur.

**Solution en place** : `app_meta.reset_epoch` (compteur entier) + une fonction `checkResetEpoch()` dans `index.html` qui compare l'epoch vu par l'appareil à celui du serveur ; si l'appareil est en retard, son cache local est vidé au lieu d'être repoussé. **Si vous touchez à `pushAllLocalToServer` ou à la logique de sync de `index.html`, relire cette section en entier d'abord.**

## 8. Backlog priorisé

### Priorité 1 — fiabilité de ce qui existe déjà (ce que l'utilisateur a demandé explicitement)
- [ ] Revue ligne par ligne de `terrain.app.js` et `admin.app.js` — trois bugs réels ont été trouvés et corrigés dans la seule session d'aujourd'hui (regex non gourmande cassant tout un écran, bouton écrasé par du code mort, index de tableau décalés) : il y en a probablement d'autres non détectés faute de temps de test exhaustif.
- [ ] Écrire de vrais tests automatisés (aucun test n'existe — tout a été vérifié manuellement avec Playwright, à la main, à chaque étape)
- [ ] Gestion d'erreur réseau : `soft()` avale silencieusement les échecs de lecture (retourne `[]`) — un site injoignable donne une app qui a l'air vide plutôt qu'un message d'erreur clair

### Priorité 2 — modules absents dans sa-terrain
- [x] **Logistique** (sortie d'inventaire, bon de livraison depuis le terrain) — 29/09 : sortie au format de SA Platform, bons en attente + nouveau bon depuis la sortie, signature au doigt (stockée comme photo du bon, validation en PATCH partiel)
- [x] **Hivernage** — 29/09 : liste de contrôle du design → rapport `rapports_hivernage` en brouillon, que le bureau complète et imprime dans SA Platform. Les « 33 sites » du design étaient fictifs : la liste = sites réels hors piscines intérieures (MI) et spas (SP), avancement = rapports de l'année
- [x] Corriger/supprimer un punch depuis le téléphone — 29/09 : semaine en cours, protocole v64 de SA Platform (k/k0/mod, pierre tombale), chaque correction marquée « à valider » (Suivi de sa-admin)
- [x] Photo dans une demande — 29/09 : colonne `demandes.photo` (+ `has_photo`), lien « Voir la photo jointe » dans le Monitoring de sa-admin

### Priorité 3 — modules absents dans sa-admin
- [x] Plan de Match (29/09) : vue équipe par jour (plan, progression, alertes de section, obstacles/bons coups, travaux du jour), création/modification (employés, véhicule de la flotte, superviseur, résumé, sections colorées, tâches + minutes), validation superviseur des tâches faites, impression de la journée de l'équipe, suppression. Écriture sûre : relit le plan et garde ce que le technicien a coché entre-temps. Reste à faire : afficher/cocher le plan dans sa-terrain (aujourd'hui seulement dans SA Platform)
- [x] Bons de travail · créneaux · tâches planning (29/09) : éditeur complet (tous les champs de SA Platform : client/site, type, priorité, statut ouvert/en cours/complété/facturé, plusieurs techniciens, description, liste de tâches, notes, exigences au punch, pièces jointes ; créneau : heure, adresse, WO lié ; tâche : période, heures, statut, copies indépendantes), création sur un jour / une période / une récurrence, suppression (ou série à venir), impression du bon et de la semaine de planning, journal d'audit
- [x] Stats (29/09) : heures de l'équipe par semaine, punchs à valider, bons de travail, stock sous le seuil, rapport d'équipe (copier / .txt)
- [ ] **Communication d'équipe** (infolettre du lundi) — nature différente des autres écrans (rédaction de contenu, pas affichage de données), mérite sa propre conception
- [x] Comptes (29/09) : liste, création, modification (rôle, droits, statut actif/inactif, saisonnier, coordonnées), suppression, sauvegarde complète JSON (sans mots de passe). Mot de passe défini par un administrateur via la fonction serveur `admin_definir_mdp` (l'admin confirme SON mot de passe, vérifié côté serveur ; changement exigé à la 1re connexion ; audit). Superviseur : lecture seule. Note : l'écran Comptes d'index.html ne peut toujours pas définir de mot de passe utilisable — passer par sa-admin
- [x] Logistique + Hivernage côté bureau (29/09) : bons de livraison (liste à livrer / livrés, création, articles livrés et récupérés, photos et signatures, marquer livré, impression), sorties d'inventaire (création par le bureau, envoi au superviseur, impression), rapports de pré-hivernage (constats par section avec priorité et photos, prévisionnel des travaux, suivi devis/travaux, calendrier T1–T4, recommandation, signataires, complété, impression). Mêmes tables et formats que SA Platform et sa-terrain
- [x] Outils · QR + Emplacements (29/09) : liste des outils (filtres disponibles / sortis / maintenance, détenteur, emplacement), création avec numéro suivant du préfixe (compteur avancé dans `logistique_config`), modification, photos, maintenance, retour forcé journalisé dans `outils_mouvements`, historique, étiquettes QR 3×3 cm imprimables (même format de code que SA Platform, bibliothèque qrcodejs intégrée au fichier), suppression. Emplacements par bâtiment/zone (ajout, modification, suppression refusée s'il reste des outils, étiquettes). Configuration : catégories, préfixes, préfixe QR. Les changements de statut et de configuration relisent le serveur avant d'écrire. **Bug de production corrigé** : SA Platform envoie `emplacement` et `photos` avec chaque outil mais la table n'avait pas ces colonnes → toutes les fiches outils étaient refusées par le serveur (0 outil en base au 29/09). Colonnes ajoutées (`MIGRATION_2026-09-29_outils_emplacement_photos.sql`, appliquée). Les outils créés avant ce correctif n'existent que sur l'appareil qui les a créés : les ré-enregistrer une fois depuis cet appareil (ou les recréer dans sa-admin)
- [ ] Paramètres / configuration de l'app — aucun écran, dans aucune des deux apps, pour changer quoi que ce soit sur le fonctionnement de l'app elle-même (valeurs par défaut, seuils, préférences d'organisation)
- [x] Stock + Flotte (29/09) : groupe « Matériel » de sa-admin. Stock : recherche, filtres par catégorie et « sous le seuil », alerte, valeur en stock, création/modification/suppression, entrée/sortie appliquée sur la quantité relue au serveur (écriture conditionnelle `updated_at`, jamais d'écrasement), export .xlsx. Flotte : liste, création/modification (plaque en majuscules, km, assignation à un employé), suppression. Mêmes colonnes que SA Platform. Attention : SA Platform ré-envoie toute sa liste locale (`sbPushAll`) quand on y enregistre un produit ou un véhicule — un poste SA Platform resté ouvert longtemps peut donc ré-écrire d'anciennes valeurs par-dessus un changement fait dans sa-admin
- [x] Temps · Paie (29/09) : grille de l'équipe par semaine (toutes les semaines, chargées à la demande), journée d'un employé (voir, corriger, ajouter, supprimer, approuver — journal d'audit), approbation de la semaine, onglet Paie (feuille regroupée / journal, Excel .xlsx, impression avec signatures, « envoyée à la paie » dans `feuilles_temps_envois`). Règle de SA Platform reprise telle quelle : 40 h régulières, le surplus en supplémentaires — SA Platform n'a pas de banque d'heures.
- [ ] Recherche globale (barre visible en haut de chaque écran, jamais branchée à une vraie recherche)
- [x] Export Facturation réel en `.xlsx` (29/09 — générateur .xlsx intégré, sans bibliothèque externe)

### Priorité 3bis — absents des DEUX apps, signalés par l'utilisateur après une vraie utilisation
- [ ] **Export PDF** — aucun écran (inspections, facturation, rapports) ne peut être exporté en PDF
- [ ] **Impression** — aucune vue imprimable nulle part, contrairement à `index.html` qui a plusieurs formulaires imprimables dédiés
- [ ] **Envoi par courriel** — aucune fonction d'envoi (rapport, demande, résultat de sondage) dans les deux apps
- [ ] **Intégrations API externes** — aucune (comptabilité, calendrier, etc.)
- [ ] **Carte (sa-admin)** — rapportée non fonctionnelle en production réelle (zone blanche, rien ne s'affiche) alors qu'elle fonctionnait dans tous les tests locaux (`file://`) effectués aujourd'hui. Un correctif a été ajouté (gestion d'erreur visible au lieu d'un écran vide, voir `Comp.prototype.syncMap` dans `admin.app.js`) mais **la cause réelle du blocage en production n'est pas confirmée** — pistes à vérifier en premier : un fichier `_headers` dans le dépôt qui poserait une Content-Security-Policy bloquant `unpkg.com`/`tile.openstreetmap.org`, ou un bloqueur de publicité/traceurs côté client bloquant ces domaines. Le message d'erreur ajouté devrait maintenant révéler laquelle.

### Priorité 4 — dette technique du process de build lui-même
- [ ] Le pipeline `assemble.py` fonctionne mais est fragile (voir §3, piège des regex non gourmandes) — envisager de le réécrire en un vrai petit compilateur de gabarit (parseur DOM plutôt que substitutions de texte) si le projet grandit encore
- [ ] Aucun contrôle de version sur les fichiers générés eux-mêmes (`sa-terrain.html`/`sa-admin.html` sont committés tels quels sur GitHub) — envisager de committer seulement les sources (`app.js`, `assemble.py`, gabarit) et générer à la volée dans un pipeline CI

## 9. Fichiers joints

- `terrain.html` / `admin.html` — les fichiers déployés actuellement en production
- `terrain.app.js` / `admin.app.js` — la logique (à éditer)
- `terrain.runtime.js` / `admin.runtime.js` — le mini-moteur de rendu (rarement à toucher)
- `terrain.assemble.py` / `admin.assemble.py` — le script de construction (à éditer si le gabarit HTML change)
- `terrain.markup.html` / `admin.markup.html` — le gabarit final généré, pour inspection (ne pas éditer directement, regénéré à chaque `assemble.py`)
- Le dossier `design_handoff_sa_platform/` (gabarits bruts de Claude Design, `SA Terrain.dc.html` / `SA Admin.dc.html`, `sa-data.js`, `sa-icons.js`, `ds/styles.css`) doit être récupéré séparément si non déjà présent — il contient le design source dont `assemble.py` extrait des morceaux.

## 10. Identifiants et accès

- Projet Supabase de production : `ldqvdiaewvhnukuaxdmc`
- Clé publique (anon) déjà en dur dans les fichiers — aucune action requise
- Dépôt GitHub : celui que l'utilisateur utilise déjà pour `index.html` — déposer `terrain.html`/`admin.html` à la racine, à côté
