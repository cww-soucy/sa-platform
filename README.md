# SA Platform — Soucy Aquatik

Tout ce dépôt est publié tel quel par **Cloudflare Pages** (`sa-platform.pages.dev`) à chaque fusion dans `main`.
**Ne jamais envoyer de fichiers directement sur GitHub** (« Add files via upload ») : passer par une branche et une PR,
pour que les tests vérifient tout avant la mise en ligne.

## Ce qui est en service (racine)
| Fichier | Rôle |
|---|---|
| `index.html` + `sw.js` | **SA Platform** — l'application d'origine. `APP_BUILD` (index.html) = `CACHE_NAME` (sw.js), à changer ensemble |
| `admin.html` | **sa-admin** — centre des opérations (bureau). **Fichier généré** à partir de `src/admin/` |
| `terrain.html` | **sa-terrain** — app du technicien (téléphone). **Fichier généré** à partir de `src/terrain/` |
| `qr-carnet/` | Carnet de bord des salles mécaniques (QR), page publique cloisonnée |
| `sondage-hivernement-levis.html`, `stats-sondages.html` | Sondages clients (liens envoyés aux clients) |
| `recuperation.html` | Outil de récupération de données |
| `sa-admin/`, `sa-terrain/` | Anciennes adresses : redirigent vers `admin.html` / `terrain.html` |
| `_headers` | Règles de cache et de sécurité de Cloudflare |

## Le reste
| Dossier | Contenu |
|---|---|
| `src/` | Sources de sa-admin et sa-terrain (`app.js`, `assemble.py`), design, bibliothèques. `python3 src/build.py` régénère `admin.html` et `terrain.html` |
| `tests/` | Tests automatiques (`npm test`), lancés par GitHub à chaque envoi |
| `supabase/functions/` | Fonctions serveur (lien calendrier `planning-ics`) |
| `docs/` | Passation (`HANDOFF-CLAUDE-CODE.md`), brief de design initial, historique SQL (`docs/sql/`) |

## Modifier sa-admin ou sa-terrain
1. Modifier `src/admin/…` ou `src/terrain/…` (jamais `admin.html` / `terrain.html` directement).
2. `python3 src/build.py` puis `npm test`.
3. Branche → PR → tests verts → fusion : Cloudflare publie.
