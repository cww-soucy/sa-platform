'use strict';
// Migrations docs/sql : depuis le 30/10/2026, Supabase ne donne plus de droits automatiques sur une nouvelle table de
// « public ». Toute table créée par une migration doit donc, dans le même fichier : activer RLS, donner ses droits à
// authenticated et service_role, et avoir des politiques qui visent authenticated (pas « to anon » seul). Voir docs/sql/README.md.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'docs', 'sql');
// Fichiers d'avant la règle (déjà appliqués en production) : exemptés
const AVANT = new Set([
  'CORRECTIF_2026-10-20_politiques_connectes.sql',
  'CORRECTIF_SYNC_COMPLET.sql',
  'DONNEES_2026-10-05_regroupement_clients.sql',
  'MIGRATION_2026-09-29_admin_definir_mdp.sql',
  'MIGRATION_2026-09-29_modules_terrain.sql',
  'MIGRATION_2026-09-29_outils_emplacement_photos.sql',
  'MIGRATION_2026-09-30_bassins_releves.sql',
  'MIGRATION_2026-10-02_communications.sql',
  'MIGRATION_2026-10-02_termine_valide.sql',
  'MIGRATION_2026-10-02_water_logs.sql',
  'MIGRATION_2026-10-04_inspections_portail.sql',
  'MIGRATION_2026-10-05_clients_sites.sql',
  'MIGRATION_2026-10-14_sondages_admin.sql',
  'MIGRATION_2026-10-19_preferences_comptes.sql',
  'MIGRATION_2026-10-19_suppressions.sql',
  'SECURISATION_ETAPE1.sql',
  'SECURISATION_ETAPE2.sql',
  'SECURISATION_ETAPE3.sql',
  'SECURISATION_ETAPE3_PREPARATION.sql',
  'plan_match_setup.sql',
  'punch_gps_log_setup.sql',
  'site_journal_setup.sql',
]);

function problemes(sql) {
  const s = sql.replace(/--[^\n]*/g, '').toLowerCase(); // sans les commentaires (retour arrière, exemples)
  const tables = [...s.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/g)].map((m) => m[1]);
  const out = [];
  for (const t of new Set(tables)) {
    const re = (x) => new RegExp(x.replace(/T/g, '(?:public\\.)?"?' + t + '"?'), 'm');
    if (!re('alter\\s+table\\s+(?:if\\s+exists\\s+)?T\\s+enable\\s+row\\s+level\\s+security').test(s)) out.push(t + ' : RLS non activé');
    for (const role of ['authenticated', 'service_role']) {
      if (!re('grant\\s[^;]*\\son\\s+(?:table\\s+)?(?:[^;]*,\\s*)?T\\b[^;]*\\sto\\s[^;]*\\b' + role + '\\b').test(s)) out.push(t + ' : pas de grant à ' + role);
    }
    for (const m of s.matchAll(new RegExp('create\\s+policy\\s[^;]*\\son\\s+(?:public\\.)?"?' + t + '"?\\b[^;]*;', 'g'))) {
      const to = (m[0].match(/\sto\s+([^;]*?)(?:\susing\b|\swith\s+check\b|;)/) || [])[1] || 'public';
      if (/\banon\b/.test(to) && !/\bauthenticated\b/.test(to)) out.push(t + ' : politique « to anon » seule (une session avec jeton ne la voit pas)');
    }
  }
  return out;
}

test('vérificateur : une table sans droits est signalée, le modèle de docs/sql/README.md passe', () => {
  assert.deepEqual(problemes('create table public.x (id text primary key);'),
    ['x : RLS non activé', 'x : pas de grant à authenticated', 'x : pas de grant à service_role']);
  assert.deepEqual(problemes("create table x (id text); alter table x enable row level security; grant select on x to authenticated, service_role;\ncreate policy p on x for select to anon using (true);"),
    ['x : politique « to anon » seule (une session avec jeton ne la voit pas)']);
  const modele = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8').split('```sql')[1].split('```')[0];
  assert.deepEqual(problemes(modele), [], 'le modèle du README respecte la règle');
});

test('migrations : chaque nouvelle table a RLS, ses grants explicites et des politiques pour authenticated', () => {
  const fautes = [];
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.sql') && !AVANT.has(x))) {
    for (const p of problemes(fs.readFileSync(path.join(DIR, f), 'utf8'))) fautes.push(f + ' → ' + p);
  }
  assert.deepEqual(fautes, [], 'voir docs/sql/README.md (droits explicites depuis le 30/10/2026)');
});
