'use strict';
// Lenteur (diagnostic 24/11/2026) : les photos en base64 ne sont plus téléchargées par le chargement global de sa-admin
// (relancé chaque minute) ni par le coffre local ; la photo d'une visite est lue à la demande.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const PH = 'data:image/png;base64,iVBORw0KGgo=';
function tables() {
  const t = base();
  t.releves.push({ id: 'rph', site_id: 1, site_nom: 'Piscine Alpha', tech: 'kael', tech_nom: 'Kaël Test', date: iso(addDays(new Date(), -1)), heure: '10:00', type_code: 'GEN',
    vals: { ph: 7.4 }, touched: { ph: 1 }, statut: 'publiee', publiee_le: new Date().toISOString(), updated_at: '2026-11-20T10:00:00Z', photo: PH });
  return t;
}
const relQ = (db) => db.log.filter((l) => l.method === 'GET' && l.table === 'releves').map((l) => decodeURIComponent(l.query));

test('chargement global : la colonne photo des relevés n’est pas demandée', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const q = relQ(db);
  assert.ok(q.length >= 1);
  q.forEach((s) => assert.doesNotMatch(s, /select=[^&]*\bphoto\b/, s));
  assert.deepEqual(errors, []);
  await page.close();
});

test('visite : la photo est lue à la demande, une seule fois', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  // la fausse base ignore select : on simule le vrai serveur en retirant la photo chargée globalement
  await page.evaluate(() => window.__admin.D.rel.forEach((r) => { delete r.photo; }));
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: '1', inspView: 'visite', inspVisite: 'rph' }));
  await page.waitForFunction(() => { const v = window.__admin.vals().iq.v; return v && v.photos && v.photos.length === 1; });
  assert.equal(await page.evaluate(() => window.__admin.vals().iq.v.photos[0].src), PH);
  await page.evaluate(() => { window.__admin.D.rel.forEach((r) => { delete r.photo; }); window.__admin.update(); });
  const n = relQ(db).filter((s) => /id=eq\.rph&select=photo/.test(s)).length;
  assert.equal(n, 1, 'photo relue depuis le cache, pas du serveur');
  assert.deepEqual(errors, []);
  await page.close();
});

test('coffre local : relevés et demandes sans leurs photos', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.vaultSnapshot());
  const q = db.log.filter((l) => l.method === 'GET' && (l.table === 'releves' || l.table === 'demandes')).map((l) => decodeURIComponent(l.query));
  assert.ok(q.some((s) => /select=id,site_id/.test(s)));
  q.forEach((s) => assert.doesNotMatch(s, /select=\*|select=[^&]*[,=]photo(,|&|$)/, s));
  assert.deepEqual(errors, []);
  await page.close();
});

test('fiche du site : le journal s’affiche sans ses photos, puis les photos arrivent par une 2e requête', async () => {
  const t = tables();
  t.site_journal = [{ id: 'j1', site_id: '1', uid: 'kael', emp: 'Kaël Test', date: iso(new Date()), heure: '09:00', lieu: 'Piscine Alpha', notes: 'Skimmer fissuré', photos: [{ data: PH }] }];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.openSiteFiche('1'));
  await page.waitForFunction(() => { const v = window.__admin.vals(); return v.sfJournal && v.sfJournal.length === 1 && v.sfJournal[0].hasPh; });
  const sj = () => db.log.filter((l) => l.method === 'GET' && l.table === 'site_journal').map((l) => decodeURIComponent(l.query));
  for (let i = 0; i < 100 && sj().length < 2; i++) await page.waitForTimeout(30);
  const q = sj();
  assert.equal(q.length, 2);
  assert.doesNotMatch(q[0], /photos|select=\*/, 'la 1re requête ne demande pas les photos');
  assert.match(q[1], /select=id,photos/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('coffre local : une copie par 20 h, pas à chaque ouverture de sa-admin', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => { sessionStorage.removeItem('sa_admin_vault_done'); localStorage.setItem('sa_admin_vault', JSON.stringify([{ ts: new Date(Date.now() - 3600000).toISOString(), data: { sites: [{ id: 1 }] } }])); });
  await page.reload();
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.waitForTimeout(6500);
  assert.equal(db.log.filter((l) => l.method === 'GET' && l.table === 'rapports_hivernage' && /select=\*/.test(l.query)).length, 0, 'copie récente : pas de nouveau téléchargement');
  await page.evaluate(() => { sessionStorage.removeItem('sa_admin_vault_done'); localStorage.setItem('sa_admin_vault', JSON.stringify([{ ts: new Date(Date.now() - 25 * 3600000).toISOString(), data: { sites: [{ id: 1 }] } }])); });
  await page.reload();
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_admin_vault') || '[]').length === 2, null, { timeout: 9000 });
  assert.deepEqual(errors, []);
  await page.close();
});
