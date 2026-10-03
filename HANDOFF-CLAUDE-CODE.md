# Passation vers Claude Code — sa-terrain / sa-admin pour Soucy Aquatik

**À lire en entier avant de toucher au code.** Ce document remplace toute explication orale.

## 1. Décision qui motive cette passation

Aujourd'hui, dans une conversation de chat (pas Claude Code), j'ai construit `sa-terrain` et `sa-admin` module par module, en testant à chaque étape. Ça a permis d'avancer, mais à un coût élevé en tokens pour un rythme lent, et surtout : **`sa-admin` n'a jamais été une copie de SA Platform**, parce qu'il vient d'un design produit séparément (Claude Design), avec ses propres écrans — pas un portage systématique de `index.html`.

L'utilisateur (Charles-William Weil, chef d'équipe) demande maintenant la **parité complète** avec SA Platform : tous les modules, la gestion complète des WO, des comptes, de la configuration. C'est un travail de fond qui doit se faire dans Claude Code : comparer chaque écran au vrai code de `index.html`, avancer module par module, sans le coût d'un aller-retour de conversation à chaque fonction.

## 2. Contexte général

Soucy Aquatik exploite **SA Platform** (`index.html`, ~944 Ko) en production sur `sa-platform.pages.dev`. C'est l'outil historique complet, en un seul fichier vanilla JS. **`index.html` tourne toujours, sans interruption — rien n'a été retiré.**

Deux nouvelles apps, même base Supabase (projet `ldqvdiaewvhnukuaxdmc`), déployées à côté :
- `sa-platform.pages.dev/terrain.html` — app iPhone du technicien
- `sa-platform.pages.dev/admin.html` — plateforme de gestion desktop

## 3. Comment le code est construit — lire avant de modifier quoi que ce soit

Pas de framework. Le design vient de Claude Design, dans une syntaxe `<sc-if>`/`<sc-for>`/`{{ expr }}` proche de JSX. Un **mini-moteur de rendu maison** (`admin.runtime.js`, ~40 lignes) l'exécute nativement dans le navigateur (converti en `<template data-sc="if|for">`, un standard HTML réel).

**`admin.assemble.py`** construit le fichier final : prend le gabarit brut (`design_handoff_sa_platform/SA Admin.dc.html`), applique des dizaines de substitutions regex (retire les attributs de démo, branche les vrais libellés, insère les blocs ajoutés), puis concatène gabarit + CSS + `admin.runtime.js` + `admin.app.js` en un seul fichier.

**Pour modifier :**
1. Éditer `admin.app.js` (la logique — l'essentiel du travail)
2. Si le gabarit HTML doit changer, éditer `admin.assemble.py`
3. `node --check admin.app.js` PUIS `python3 admin.assemble.py` → régénère `admin.html`
4. **Toujours vérifier avec `grep` que le changement est bien dans le fichier généré, pas seulement que le script n'a pas planté.**

### Le piège rencontré au moins 4 fois aujourd'hui, à éviter absolument

**`Comp.prototype.load()` fait un seul `Promise.all([...])` avec ~18 requêtes, et le code lit les résultats par index numérique (`r[12]`, `r[13]`...).** Chaque fois qu'une requête est ajoutée ou retirée de cette liste, TOUS les index après elle décalent — et rien ne le signale à la compilation. C'est la cause de plusieurs régressions aujourd'hui (Sondages, Carte, Facturation cassés tour à tour par des ajouts ailleurs).

**Recommandation forte pour Claude Code : remplacer ces index numériques par un objet nommé** avant d'ajouter le moindre nouveau module — par exemple :
```js
Promise.all([get('sites?...'), get('contrats?...'), ...])
  .then(function(r){
    var D = {sites:r[0], contrats:r[1], ...}; // dernière fois avec des index
    // À FAIRE : passer à une forme où chaque requête a un nom, ex. via un objet
    // {sites: get(...), contrats: get(...)} + Promise.all(Object.values(...)) ou une petite
    // fonction utilitaire qui zippe noms et résultats — pour que l'ajout d'un module ne décale
    // plus jamais silencieusement les autres.
  });
```
C'est la dette technique n°1 à régler avant d'ajouter les modules du backlog ci-dessous, sinon chaque ajout continuera de risquer une régression silencieuse ailleurs.

## 4. Le contrat de fusion des punchs — à respecter scrupuleusement

`index.html` a un mécanisme de fusion (`mergeFTDay`) qui reconnaît un punch corrigé sur un autre appareil grâce à trois champs sur chaque tâche :
- **`k`** : identifiant stable (généré une fois, ne change jamais)
- **`k0`** : signature d'origine (`heure_début|lieu` au moment de la création), conservée même après une correction
- **`mod`** : horodatage numérique (`Date.now()`) de la dernière correction manuelle — sert à déterminer quelle version gagne

**Toute écriture sur une tâche de `feuilles_temps` (ajout, modification, validation) doit appeler l'équivalent de `ftMarquerModif(t)` AVANT de changer `lieu`/`start`/`end`** :
```js
function ftMarquerModif(t){ if(!t.k){ t.k0=ftSig(t); t.k=ftUid(); } t.mod=Date.now(); return t; }
```
Cette fonction existe déjà dans `admin.app.js` (`ftMarquerModif`, `ftSig`, `ftUid`) — **tout nouveau code touchant aux punchs doit l'utiliser**, sinon la correction risque d'être silencieusement écrasée au prochain sync de SA Platform (bug vécu et corrigé aujourd'hui).

Une suppression doit aussi poser une pierre tombale dans `days[i].del` (voir `Comp.prototype.pmDelete` pour l'exemple exact), sinon SA Platform ramène le punch supprimé.

## 5. Schéma Supabase — tables ajoutées aujourd'hui (additif, rien retiré)

| Table | Rôle |
|---|---|
| `types_bassin` | 7 types de bassin (valeurs de référence du design, **jamais validées par l'utilisateur**) |
| `contrats` | 1 ligne par site, lie un site à un `type_code` |
| `releves` | Relevés techniques (sa-terrain écrit, sa-admin lit) |
| `demandes` | Demandes de matériel/renfort/urgence |
| `app_meta` | `reset_epoch` (entier) — garde-fou anti-résurrection de données côté `index.html` |
| `projets_excel` | 34 projets importés du fichier Excel de pilotage de l'utilisateur |
| `facturation` | 42 dossiers importés du même fichier (ODT, prix calculé/facturé, statut). **La colonne PO est vide partout dans le fichier source — ce n'est pas un bug, l'utilisateur ne l'a jamais remplie.** |
| `ft_envois` | Traçabilité des exports de feuilles de temps (équipe/employé/impression), même modèle que `ftenvois` dans `index.html` |
| `feuilles_temps_hist`, `histo_modifs` | Copie automatique de toute ligne modifiée/supprimée sur `feuilles_temps`, `workorders`, `plan`, `planning_tasks`, `sites`, `contrats`, `facturation` — déclencheurs SQL, ne jamais désactiver |

Politiques RLS additionnelles sur `workorders`/`planning_tasks` : `wo_insert_fresh`/`pt_insert_fresh` refusent un INSERT dont `created_at` est antérieur à `app_meta.created_cutoff`.

## 6. Ce qui EST fait aujourd'hui dans sa-admin, testé réellement

- **Monitoring, Inspections, Opérations (modifier/terminer/supprimer), Sites (fusion/validation/fiche), Planning équipe (créer, séries récurrentes), Sondages, Carte (Leaflet + punchs GPS), Facturation (import Excel réel, cycle de statut, export .csv)**
- **Temps · Suivi · Cumul** : grille par employé, filtre actif/inactif
- **Gestion complète des punchs** (`Comp.prototype.openPunchMgmt` et associées) : voir/ajouter/modifier/supprimer n'importe quel punch d'un employé, pas seulement les signalés — respecte le contrat `k`/`k0`/`mod`
- **Module FT** : export Excel réel (`.xlsx`, équipe ou individuel), impression avec lignes de signature, ouverture du client courriel (`mailto:`), marquage d'envoi dans `ft_envois`

## 7. Ce qui N'EST PAS fait — la vraie liste, vérifiée dans le code de `index.html`, pas de mémoire

19 modules existent dans `index.html` (`grep` sur les identifiants `switchMod` — voir la liste exacte ci-dessous). **11 sont absents des deux nouvelles apps :**

| Module `index.html` | Fonctions clés à porter (`grep -n "^function render"` dans `index.html`) |
|---|---|
| **Comptes** | `renderComptesList` — création/désactivation d'employé, changement de mot de passe, gestion des rôles |
| **Plan de Match** | (module distinct de Planning — vérifier son rôle exact dans `index.html` avant de commencer, ne pas confondre avec Planning équipe déjà fait) |
| **Flotte** | `renderFlotteList` |
| **Inventaire** | `renderInvList` |
| **Sortie** | `renderSortieList`, `renderSortieScanButton` — scan de code-barres pour sortie de matériel |
| **Livraison** | `renderLivraisonList` — bons de livraison |
| **Hivernage** | rapports de pré-hivernage, 33 sites — déjà un module fini dans `index.html`, à porter tel quel |
| **Outils** | `renderToolFilterBar`, `renderToolList`, `renderToolPhotos` — gestion d'outillage avec photos |
| **Config logistique** | `renderLogiConfig` |
| **Emplacements** | module à examiner dans `index.html`, rôle exact non déterminé aujourd'hui |
| **Paramètres / configuration de l'app** | Aucun écran dans les deux nouvelles apps pour changer le fonctionnement de l'app elle-même |

Modules partiellement portés, à compléter :
- **Work Orders** : création/modification simple faite dans sa-admin ; **pas de gestion complète** (pièces jointes, tâches détaillées par WO, filtres avancés — comparer à `renderWOList`, `renderWOTaskList`, `renderWOFilterBar` dans `index.html`)
- **Stats** : KPI dispersés dans Monitoring, pas un vrai module Stats comme `renderStats` dans `index.html`
- **Plan (créneaux)** : présent dans Planning équipe côté création, pas de vue dédiée comme dans `index.html`

Absent des DEUX apps, signalé par l'utilisateur :
- **Export PDF**, nulle part
- **Intégrations API** externes (comptabilité, calendrier) — aucune
- Le système de pièces jointes de `index.html` (`renderMPj`, `renderPeBassins`, `renderPePj`, `renderSBassins`, `renderSEquips`, `renderSPj`, `renderSitePj`, `renderWOPj`) n'a d'équivalent nulle part

## 8. Comment procéder pour l'inventaire de départ (méthode qui a fonctionné aujourd'hui)

Ne pas se fier à la mémoire ni à un audit précédent. Lister les modules réels :
```bash
python3 -c "
import re
s=open('index.html',encoding='utf-8').read()
i=s.find(\"switchMod(mod)\")
print(s[i-1200:i+200])  # affiche le tableau de définition des modules et leurs libellés
"
grep -oE '^function render[A-Z][a-zA-Z]*\(' index.html | sort -u
```
Puis, pour CHAQUE module du backlog ci-dessus, lire les fonctions `render*` correspondantes dans `index.html` avant d'écrire quoi que ce soit dans `admin.app.js` — c'est la seule façon de ne pas refaire un audit approximatif.

## 9. sa-terrain — état

Le fichier `terrain.html` fourni dans cette passation contient déjà des correctifs de synchronisation faits par une session Claude Code précédente (voir l'historique de commentaires en tête de `sw.js`, versions v77/v78 : sécurité de connexion, fusion des feuilles de temps par signature d'origine, correctifs sur Hivernage et Sortie). **Je n'ai pas trouvé de bug de synchronisation reproductible dans `terrain.html` lui-même** après deux scénarios de test réels (punch simple, séquence de 3 actions hors-ligne puis reconnexion) — les deux ont fonctionné correctement. Si l'utilisateur signale encore un problème de synchro sur le téléphone, demander une description précise (message d'erreur exact, moment où ça arrive, capture d'écran) avant de modifier quoi que ce soit — deviner a coûté cher aujourd'hui.

## 10. Sécurité — limite connue, non réglée

Clé publique Supabase en clair dans le fichier (comme `index.html`). Connexion vérifiée côté serveur (`rpc/verifier_connexion`), mais **rien n'empêche un accès direct à l'API REST en contournant le login** — même limite que `index.html` aujourd'hui, pas une régression introduite par les nouvelles apps, mais pas réglée non plus. Si la gestion des comptes/rôles est portée dans sa-admin, envisager de vérifier le rôle serveur-side (fonction Postgres `security definer`) avant d'exposer des actions sensibles (créer un compte, changer un mot de passe).

## 11. Fichiers joints

- `admin.html`, `terrain.html`, `index.html`, `sw.js` — les fichiers tels que déployés/reçus aujourd'hui
- `admin.app.js`, `admin.runtime.js`, `admin.assemble.py`, `admin.markup.html` — les sources de sa-admin (éditer `admin.app.js`, régénérer avec `admin.assemble.py`)
- `design_handoff_sa_platform/` — le design source (gabarits `.dc.html`, `sa-data.js`, `sa-icons.js`, `ds/styles.css`)
- **Pas de sources séparées pour `terrain.html`** dans ce paquet : il vient d'une session Claude Code antérieure dont je n'ai pas les fichiers sources (`app.js`/`assemble.py` équivalents) — seulement le fichier final. Si des sources existent quelque part (poser la question à l'utilisateur), les récupérer avant de modifier `terrain.html` à la main dans le fichier final géant.

## 12. Accès requis (à configurer par l'utilisateur, pas par moi)

- Dépôt GitHub où déposer les fichiers (celui déjà utilisé pour `index.html`)
- Projet Supabase `ldqvdiaewvhnukuaxdmc` — clé publique déjà en dur dans les fichiers, accès admin/SQL à demander à l'utilisateur si des migrations sont nécessaires
