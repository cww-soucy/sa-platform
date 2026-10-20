# Consignes pour Claude Code — SA Platform (Soucy Aquatik)

Lire d'abord `README.md`, `src/README.md` et `docs/HANDOFF-CLAUDE-CODE.md`.

- `admin.html` / `terrain.html` sont générés : modifier `src/admin/…` ou `src/terrain/…`, puis `python3 src/build.py`.
- Toute modification d'`index.html` : monter ensemble `APP_BUILD` (index.html) et `CACHE_NAME` (sw.js), jamais sous v80.
- `npm test` doit passer ; un test par correctif (banc d'essai `tests/harness.js`). Branche → PR → tests verts, jamais sur `main`.
- Base de production : ne rien appliquer sans demande explicite ; préparer le SQL dans `docs/sql/`.

## Base de données (Supabase) — règles depuis le 30/10/2026

Nouvelle table dans `public` = **aucun droit automatique**. Dans la même migration : RLS activé, `grant` explicite
à `authenticated` et `service_role` (à `anon` seulement pour une page publique), politiques `to authenticated`
(jamais `to anon` seul). Modèle complet et explications : `docs/sql/README.md`. Vérifié par `tests/migrations-droits.test.js`.
