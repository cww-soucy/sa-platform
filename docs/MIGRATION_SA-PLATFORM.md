# Migration SA Platform (`index.html`) → sa-admin (`admin.html`)

> But : faire de **sa-admin** le corps officiel du projet et mettre **SA Platform en fantôme**
> (redirection `index.html` → `admin.html`). Ce document prouve, module par module, que tout
> est couvert avant de couper. Rien n'est mis en fantôme tant que la **checklist finale** n'est pas verte.
>
> Méthode : comparaison par **module** et par **cluster de fonctions** (index.html expose ~592 fonctions,
> regroupées par préfixe : `fte`, `plg`, `pmm`, `dp`, `hiv`, `wo`, `liv`, `sortie`, `sond`, `emp`, `tool`…),
> mappées sur les modules sa-admin (`src/admin/app.js`). Statuts : ✅ présent · 🟡 partiel · ❌ manquant.

## 1. Modules

| SA Platform (`data-mod`) | Fonctions clés (index.html) | sa-admin | Statut |
|---|---|---|---|
| `accueil` | tuiles + compteurs | tableau de bord (`vals`, KPIs) | ✅ |
| `wo` (Work Orders) | `wo*`, édition/impression | module WO / opérations | ✅ |
| `plan` (créneaux) | `dp*` (créneaux, récurrence) | planning / créneaux (`fe`, `whenModes`) | ✅ |
| `planmatch` (Plan de Match) | `pmm*` | module planmatch | ✅ |
| `planning` | `plg*`, `jg*` (gantt), liens WO/plan | module planning (semaine/4 sem./gantt) | ✅ |
| `ft` (feuilles de temps) | `fte*` (50 fn), validation, Excel paie | module **Temps** (`tempsVals`, `exportPaie`) | ✅ |
| `suivi` (live) | `cop*`, `board*`, carte live | module **monitoring** | ✅ |
| `sites` | `site*`, fusion, clients | module sites (+ fusion `site_fusionner`) | ✅ |
| `flotte` | véhicules | module flotte | ✅ |
| `inventaire` | stock | module **stock** | ✅ |
| `sortie` | `sortie*` (sorties d'inventaire) | logistique → sorties | ✅ |
| `livraison` | `liv*` (bons de livraison) | logistique → livraisons | ✅ |
| `hivernage` | `hiv*` (10 fn) | module hivernage | ✅ |
| `comptes` | rôles, droits, statut, mdp | module comptes (+ superadmin) | ✅ |
| `stats` | statistiques | module stats | ✅ |
| `map` | carte GPS | module **carte** | ✅ |
| `outils` | `tool*` (QR) | module outils | ✅ |
| `emplacements` | `emp*` | outils → **Emplacements** | ✅ |
| `logiconfig` | catégories, préfixes, QR, emplacements | outils → **Configuration** (`logistique_config`) | ✅ |
| `sondages` | `sond*` (8 fn) | module sondages | ✅ |

**En plus dans sa-admin (absents d'index.html) :** inspections, facturation, opérations, affichage
configurable des apps par profil, portail client.

## 2. Droits d'accès

Les 10 clés sont **identiques** dans les deux apps :

```
plan · ft · suivi · wo · sites · flotte · inventaire · comptes · stats · map
```

- index.html : `DROITS_LABELS` (ligne 3791) + `renderDroitsForm`.
- sa-admin : `var DROITS` (`src/admin/app.js:902`), même libellés, même logique
  (admin = tous les droits ; superviseur lecture ; superadmin = admin + protections).

**Statut : ✅ parité complète.** (Plus : rôle `superadmin` ajouté côté sa-admin.)

## 3. Réglages / préférences / options

| Élément | index.html | sa-admin | Statut |
|---|---|---|---|
| Préférences par compte (mode compte/appareil) | `preferences_comptes` | `preferences_comptes` (`prefs`, `monSync`) | ✅ |
| Synchro offline-first (statut 🟡/🟢) | `sbStatus`, `syncPull/Push` | `soft()`, jetons, renouvellement | ✅ |
| Thème (`theme-color`) | `#0D3B6E` | idem | ✅ |
| Notifications | **désactivées (no-op)** ligne 2660 | — | ✅ (rien à porter) |

## 4. Sauvegarde / export / import

| Fonction | index.html | sa-admin | Statut |
|---|---|---|---|
| Export JSON complet | `exportAllData` | `exportAll` | ✅ |
| Exports Excel (paie, facturation…) | `exportExcel` | `xlsxBlob`, `exportPaie` | ✅ |
| Export CSV des heures | `exportHoursCSV` | — | 🟡 (mineur, à décider) |
| **Coffre de sauvegarde local** (snapshots navigateur auto + restauration) | `scheduleVault`, `doVault`, `stripPhotosForVault`, `getVault`, `restoreVault` | — | ❌ **à porter** |
| Import de données | *aucune fonction d'import réelle* (les « import » du code sont des faux positifs) | — | ✅ (rien à porter) |

## 5. Écarts à implémenter avant la mise en fantôme

1. ❌ **Coffre de sauvegarde local** → **à porter dans sa-admin** (décision retenue).
   Snapshot auto périodique dans le navigateur (sans photos, pour l'espace), restaurable via le badge
   de version ; fusion non destructive. Référence : `index.html:2439` (`scheduleVault`) → `2650` (`restoreVault`).
2. 🟡 **Export CSV des heures** (`exportHoursCSV`) → à trancher : porter, ou considérer couvert par l'Excel de paie.

## 6. Mise en fantôme (décision retenue : redirection)

- `index.html` redirige automatiquement vers `admin.html` (un seul point d'entrée).
- Conserver une sortie de secours minimale si besoin (paramètre d'URL) le temps de la transition.
- ⚠️ Règle `CLAUDE.md` : toute modification d'`index.html` impose de monter **ensemble**
  `APP_BUILD` (index.html, actuellement `v83`) **et** `CACHE_NAME` (`sw.js`, `sa-platform-v83`) — jamais sous v80.
- Le service worker (`sw.js`) devra servir la redirection et purger l'ancien cache.

## 7. Checklist finale (à cocher avant de couper)

- [ ] Coffre de sauvegarde porté et testé dans sa-admin (`tests/harness.js`)
- [ ] Décision export CSV des heures (porté ou abandonné, tracé ici)
- [ ] Revue ciblée des 592 fonctions par cluster : aucune capacité orpheline (à confirmer pendant l'implémentation)
- [ ] `npm test` vert
- [ ] Redirection `index.html` → `admin.html` + `APP_BUILD`/`CACHE_NAME` montés ensemble
- [ ] Validation finale par le créateur (superadmin)

---
*Audit initial : balayage comparatif de haut niveau confirmant la parité des modules, droits et réglages.
Les seuls écarts sont le coffre de sauvegarde (à porter) et l'export CSV des heures (à trancher).
La revue fine par cluster se fait pendant l'implémentation, avant de cocher la checklist.*
