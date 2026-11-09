'use strict';
// Migration SA Platform → sa-admin : fonctions portées depuis index.html.
//  1) Export CSV des heures (exportHoursCsv)
//  2) Coffre de sauvegarde local (vaultSnapshot / vaultRestore) — filet de sécurité non destructif.
// Voir docs/MIGRATION_SA-PLATFORM.md.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const prete = (page) => page.waitForFunction(() => window.__admin && window.__admin.D);

test('Export CSV des heures : un fichier SA_heures_*.csv avec une ligne par punch', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await prete(page);
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => window.__admin.exportHoursCsv()),
  ]);
  assert.match(dl.suggestedFilename(), /^SA_heures_\d{4}-\d\d-\d\d\.csv$/);
  const f = path.join(os.tmpdir(), 'sa-csv-' + Date.now() + '.csv');
  await dl.saveAs(f);
  const txt = fs.readFileSync(f, 'utf8');
  assert.match(txt, /Employé.*Semaine.*Jour.*Lieu.*Début.*Fin.*Heures/); // en-tête
  assert.match(txt, /Entrepôt/);  // le punch du fixture (lieu Entrepôt, 07:00→08:00)
  assert.match(txt, /07:00/);
  assert.deepEqual(errors, []);
});

test('Coffre : un snapshot local capture les tables non vides (photos retirées)', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await prete(page);
  const ok = await page.evaluate(() => window.__admin.vaultSnapshot());
  assert.equal(ok, true);
  const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('sa_admin_vault') || '[]'));
  assert.equal(snap.length, 1, 'un snapshot stocké');
  assert.ok(snap[0].ts, 'horodaté');
  assert.ok((snap[0].data.sites || []).length >= 1, 'les sites sont capturés');
  assert.deepEqual(errors, []);
});

test('Coffre : la restauration recrée une ligne manquante sans toucher aux existantes', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await prete(page);
  await page.evaluate(() => window.__admin.vaultSnapshot());

  // Simule une perte : on retire le site id=2 côté serveur (fake DB).
  const avant = db.rows('sites').length;
  db.t.sites = db.rows('sites').filter((s) => s.id !== 2);
  assert.equal(db.rows('sites').length, avant - 1);

  await page.evaluate(() => window.__admin.vaultRestore(0)); // renvoie la promesse → attend la fin des POST

  // La ligne manquante est revenue ; aucune ligne existante dupliquée.
  const ids = db.rows('sites').map((s) => s.id).sort();
  assert.ok(ids.includes(2), 'le site manquant a été recréé');
  assert.equal(new Set(ids).size, ids.length, 'aucun doublon');
  assert.deepEqual(errors, []);
});

test('Fantôme : index.html (SA Platform) redirige vers /admin.html', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /http-equiv="refresh"[^>]*url=\/admin\.html/, 'meta refresh vers /admin.html');
  assert.match(html, /location\.replace\('\/admin\.html'/, 'redirection JS vers /admin.html');
  assert.ok(html.length < 4000, 'index.html est désormais un shim léger, plus l’app complète');
  assert.doesNotMatch(html, /navigator\.serviceWorker\.getRegistrations[\s\S]*unregister/, 'ne désinscrit pas le SW racine (partagé avec sa-terrain)');
});
