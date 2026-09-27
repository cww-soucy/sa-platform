# SA — Direction artistique « Réactif »

Deux applications, une base Supabase, un système de tokens.

| App | Fichier | Usage | Thème par défaut |
|---|---|---|---|
| **La Tournée** (`sa-terrain`) | `sa-terrain/index.html` | iPhone du technicien, en plein soleil, gants mouillés | Papier (clair, contraste maximal) |
| **SA Gestion** (`sa-admin`) | `sa-admin/index.html` | Bureau, double écran, sessions longues | Encre (salle de contrôle) |

Chaque app est **un seul fichier HTML autonome** (CSS et JS inclus, aucun framework, aucun build).
Seuls fichiers à côté : `sw.js` (hors-ligne), `manifest.webmanifest`, `icon.svg` — requis pour une PWA.

## L'idée

On quitte la « app SaaS bleue » pour le vocabulaire **du métier** :

- **Les réactifs de test.** Chaque paramètre porte la couleur de son test : chlore = magenta DPD,
  pH = rouge phénol, alcalinité = vert de bromocrésol, etc. Sur le terrain comme au bureau,
  le même paramètre a toujours la même couleur (`--rx-*`).
- **La signalisation de piscine.** Titres larges et lourds (Archivo en largeur 118 %), chiffres
  condensés façon marquage de profondeur (Archivo 78 %). Les lectures se voient à un mètre.
- **La corde de couloir.** Le seul motif décoratif (`--lane`) : bande jaune/marine/blanc sous
  l'en-tête et dans les barres de progression.
- **Un seul jaune d'action.** `--signal` (jaune bouée) est réservé à l'action principale d'un écran
  et à la sélection. Il n'est jamais décoratif.
- **Des registres, pas des cartes.** Listes et tableaux à filets fins, sections ouvertes par un
  filet épais. Pas d'ombres portées, pas de dégradés, angles francs (rayon 2–8 px).

Évité volontairement (brief) : navy/aqua en dégradé, cartes blanches flottantes, crème + terracotta,
étiquettes en MAJUSCULES, emoji décoratifs, kit Jira. Les icônes sont des SVG au trait, inline.

## Tokens (`design/tokens.css`)

Source de vérité, recopiée dans les deux apps entre les marqueurs `==TOKENS==` / `==/TOKENS==` :

```
design/sync-tokens.sh   # recopie les tokens dans sa-terrain et sa-admin
```

(Outil de développement seulement : les apps n'en dépendent pas pour fonctionner.)

| Famille | Tokens | Règle |
|---|---|---|
| Identité | `--sa-marine` `#004987` | Logo et repères de marque. Non modifiable. |
| Encre | `--ink-50` … `--ink-950` | Neutres froids tirés du marine. |
| Action | `--signal`, `--signal-ink` | Une action principale par écran. |
| Réactifs | `--rx-chlore`, `--rx-combine`, `--rx-ph`, `--rx-alc`, `--rx-temp`, `--rx-niveau`, `--rx-turb`, `--rx-cya` | Identité d'un paramètre. Jamais un état. |
| États | `--ok`, `--warn`, `--crit` (+ `-bg`) | Toujours accompagnés d'une icône ou d'un libellé. |
| Sémantiques | `--bg`, `--surface`, `--surface-2`, `--line`, `--line-strong`, `--text`, `--text-2`, `--text-3`, `--accent` | Seuls tokens utilisés par les composants ; redéfinis par thème. |
| Typo | `--font` (Archivo), `--mono` (IBM Plex Mono), `--wide`, `--narrow`, `--t-2xs` … `--t-4xl` | Mono pour codes (ODT, PO, heures). |
| Espace / forme | `--s1` … `--s12`, `--r1` … `--r3`, `--touch` (56 px), `--touch-min` (48 px) | Terrain : aucune cible sous 48 px. |

Thèmes : `data-theme="papier"` et `data-theme="encre"` sur `<html>`. Les deux apps offrent les deux.

## La Tournée — points clés

- **Fiche adaptative** : les champs sont générés depuis `PROFILS[profil].params` (type `num`, `bool`,
  `choice`), avec zones optimale/acceptable, requis, produits et exigences photo/notes propres au
  contrat. Chaque bassin d'un site pointe vers un profil. Ajouter un type de contrat = ajouter un profil,
  aucun écran à coder.
- Curseur tactile + boutons −/+ de 56 px ; verdict en clair (« Élevé — hors norme, corriger avant de quitter »).
- Le punch pilote tout : l'onglet Fiche affiche le site punché ; changer de site régénère la fiche.
- Hors-ligne : tout est écrit localement d'abord, compteur « n en attente » dans l'en-tête.
- Option « Taille du texte : Grande » dans Profil.

## SA Gestion — points clés

- Monitoring : équipe punchée, salles mécaniques triées par gravité (jauges par réactif), flux terrain.
- Opérations : **un dossier par client/contrat** (`groupe_id`), visites dépliables dessous, jamais éclatées.
- Planning : grille technicien × jour + générateur « Tous les [jour] jusqu'au [date] » avec retrait
  date par date et aperçu dans la grille.
- Facturation : ODT, PO (manquant signalé), prix calculé vs facturé, écart en $ et %, statut éditable.
- Temps / Suivi / Cumul : **habillage seulement** — voir plus bas.
- Recherche globale (`/`) : site, client, n° de dossier, ODT ou PO.

## Ce qui est démo vs. ce qui reste (phase 2)

Phase 1 (ce commit) = design intégré et navigable, sur **données de démonstration** calquées sur les
tables Supabase existantes. Rien n'écrit en base. Prochaines étapes :

1. **Brancher `DATA`** (un seul point par app) sur Supabase en reprenant la synchro offline-first de
   SOUCY OPS (`syncPull`/`mergeById`, garde-fou `reset_epoch`, mapping camelCase ↔ snake_case).
2. **Profils de relevé par contrat** : nouveau champ à créer (proposition : `sites.bassins[].profil`
   + table `profils_releve` jsonb). À valider avant toute migration.
3. **Temps / Suivi / Cumul** : copier *telles quelles* les fonctions de calcul et de validation de
   SOUCY OPS (`weekTotal`, `dayTotal`, `refreshCumul`, `isPunchAllowed`, etc.) et ne remplacer que le
   rendu HTML. Les valeurs affichées aujourd'hui sont fictives.
4. Carte : remplacer le fond SVG schématique par Leaflet (déjà utilisé) si le fond de carte réel est requis.

## Tester

Ouvrir les fichiers directement dans un navigateur suffit (le service worker ne s'active qu'en http/https).
Pour le terrain, utiliser le mode appareil iPhone du navigateur (390 × 844).
