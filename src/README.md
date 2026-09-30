# Sources de sa-admin et sa-terrain

`admin.html` et `terrain.html` (à la racine) sont **générés** — ne pas les éditer à la main.

| Quoi | Où |
|---|---|
| Logique | `admin/app.js`, `terrain/app.js` (95 % du travail) |
| Gabarit (substitutions sur le design) | `admin/assemble.py`, `terrain/assemble.py` |
| Design source (Claude Design) | `design/` |
| Leaflet (intégré à admin.html) | `vendor/leaflet-1.9.4/` |

```sh
python3 src/build.py          # régénère admin.html et terrain.html à la racine
npm install                   # une fois (Playwright)
npm test                      # vérifie que la racine correspond aux sources, puis lance les tests navigateur
```

Les tests (`tests/`) ouvrent les fichiers générés dans Chromium, en HTTP (comme sur Cloudflare Pages),
avec un faux Supabase en mémoire (`tests/harness.js`) : aucune donnée réelle n'est lue ni écrite.
Ils tournent aussi sur GitHub à chaque push (`.github/workflows/tests.yml`).

Contexte complet : `docs/HANDOFF-CLAUDE-CODE.md`.
