'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, weekKey, dayIdx } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function ready(page) { await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt); await page.waitForTimeout(100); }
const header = (page) => page.evaluate(() => window.__terrain.vals().syncLbl);

test('chaque écran s’affiche sans erreur JavaScript', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  for (const s of ['today', 'temps', 'fiche', 'planning', 'demandes', 'profil', 'punchform', 'stopform']) {
    await page.evaluate((x) => window.__terrain.go(x), s);
    await page.waitForTimeout(100);
    assert.ok((await page.locator('#app').innerText()).trim().length > 0, s + ' : écran vide');
  }
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  assert.equal(await page.evaluate(() => window.__terrain.vals().isFiche), true);
  assert.deepEqual(errors, []);
  assert.match(await header(page), /^Connecté/);
  await page.close();
});

test('tournée : seuls les travaux assignés EXACTEMENT au technicien (pas « kael2 » pour « kael »)', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  const ids = await page.evaluate(() => window.__terrain.jobs.map((j) => j.id));
  assert.deepEqual(ids, ['wo:wo-mine']);
  await page.close();
});

test('sites fusionnés absents du choix de site au punch', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  const noms = await page.evaluate(() => { window.__terrain.openPunchForm(null); return window.__terrain.vals().pf.sites.map((s) => s.nom); });
  assert.ok(!noms.includes('Vieux doublon'), noms.join(', '));
  assert.ok(noms.includes('Piscine Alpha'));
  await page.close();
});

test('punch : démarrer puis terminer écrit la feuille de temps au serveur', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await page.evaluate(() => { const t = window.__terrain; t.openPunchForm(null); t.setState({ pf: Object.assign({}, t.state.pf, { siteId: '1', lieu: 'Piscine Alpha' }) }); t.submitPunch(); });
  await page.waitForFunction(() => window.__terrain.ops().length === 0);
  let tasks = db.rows('feuilles_temps')[0].days[dayIdx()].tasks;
  assert.equal(tasks.length, 2);
  assert.equal(tasks[1].lieu, 'Piscine Alpha');
  assert.equal(tasks[1].active, true);
  assert.ok(db.rows('punch_gps_log').some((g) => g.site_id === '1' && g.src === 'pending'), 'journal GPS créé');
  await page.evaluate(() => window.__terrain.submitStop());
  await page.waitForFunction(() => window.__terrain.ops().length === 0);
  tasks = db.rows('feuilles_temps')[0].days[dayIdx()].tasks;
  assert.equal(tasks[1].active, false);
  assert.ok(tasks[1].end);
  await page.close();
});

test('première semaine sans feuille : la feuille est créée', async () => {
  const tables = base(); tables.feuilles_temps = [];
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables });
  await ready(page);
  await page.evaluate(() => { const t = window.__terrain; t.setState({ pf: { q: '', lieu: 'Piscine Beta', siteId: '2', odt: '', detail: '', km: '', src: null } }); t.submitPunch(); });
  await page.waitForFunction(() => window.__terrain.ops().length === 0);
  const row = db.rows('feuilles_temps')[0];
  assert.equal(row.id, 'kael_' + weekKey());
  assert.equal(row.days[dayIdx()].tasks[0].lieu, 'Piscine Beta');
  await page.close();
});

test('updated_at NULL sur la feuille : le punch passe quand même (filtre is.null)', async () => {
  const tables = base(); tables.feuilles_temps[0].updated_at = null;
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables });
  await ready(page);
  await page.evaluate(() => { const t = window.__terrain; t.setState({ pf: { q: '', lieu: 'Piscine Beta', siteId: '2', odt: '', detail: '', km: '', src: null } }); t.submitPunch(); });
  await page.waitForFunction(() => window.__terrain.ops().length === 0);
  assert.match(db.writes('feuilles_temps')[0].query, /updated_at=is\.null/);
  await page.close();
});

test('lecture impossible : l’en-tête le dit au lieu d’afficher une journée vide', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base(), fail: { workorders: 500 } });
  await page.waitForFunction(() => window.__terrain && /Données incomplètes/.test(window.__terrain.vals().syncLbl));
  assert.match(await header(page), /tournée du jour \(HTTP 500\)/);
  await page.close();
});

test('fiche refusée par le serveur : erreur visible, fiche gardée sur le téléphone', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base(), fail: { releves: 400 } });
  await ready(page);
  await page.evaluate(() => { const t = window.__terrain; t.open('wo:wo-mine'); t.vals().validate(); });
  await page.waitForFunction(() => /refusée par le serveur \(HTTP 400\)/.test(window.__terrain.vals().syncLbl));
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sa_terrain_queue')).length), 1);
  delete db.fail.releves;
  await page.evaluate(() => window.__terrain.flush());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue')).length === 0);
  assert.equal(db.rows('releves').length, 2);
  assert.doesNotMatch(await header(page), /refusée/);
  await page.close();
});

test('site à plusieurs bassins : choix du bassin, paramètres propres au bassin, un relevé par bassin', async () => {
  const t = base();
  t.sites[0].bassins = [{ id: 'b1', nom: 'Bassin principal', type: 'piscine', type_code: 'MI' }, { id: 'b2', nom: 'Pataugeoire', type: 'pataugeoire', type_code: 'GEN' }];
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: t });
  await ready(page);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  await page.getByRole('group', { name: 'Bassin' }).getByRole('button', { name: 'Pataugeoire' }).waitFor();
  assert.equal(await page.evaluate(() => window.__terrain.vals().cur.bassin), 'Bassin principal');
  await page.evaluate(() => window.__terrain.vals().validate());
  await page.getByRole('group', { name: 'Bassin' }).getByRole('button', { name: 'Pataugeoire' }).click();
  const v = await page.evaluate(() => { const c = window.__terrain.vals().cur; return { b: c.bassin, t: c.typeLabel, sid: c.sid }; });
  assert.equal(v.b, 'Pataugeoire');
  assert.match(v.t, /Bassin générique/);
  assert.equal(v.sid, '1#b2');
  await page.evaluate(() => window.__terrain.vals().validate());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  const rows = db.rows('releves').filter((r) => r.id !== 'r1').map((r) => [r.bassin, r.type_code, r.id.endsWith('-b2')]);
  assert.deepEqual(rows.sort(), [['Bassin principal', 'MI', false], ['Pataugeoire', 'GEN', true]]);
  assert.ok(!db.log.some((l) => l.rejected), 'aucune colonne inconnue envoyée (_sk retiré)');
  await page.close();
});

test('connexion : logo, puis écran de bienvenue au nom de l’employé, puis « Bonjour » en tête de la tournée', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: null, tables: base() });
  db.rpc.verifier_connexion = () => [{ id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '' }];
  assert.match(await page.locator('#login img.logo').getAttribute('src'), /^data:image\/png;base64,/);
  await page.fill('#lu', 'kael'); await page.fill('#lp', 'x'); await page.click('#loginForm button');
  await page.getByRole('status').getByText('Bienvenue, Kaël !').waitFor();
  await page.waitForFunction(() => /^(Bonjour|Bon après-midi|Bonsoir) Kaël$/.test(window.__terrain.vals().headerTitle));
  await page.reload();
  await page.waitForFunction(() => window.__terrain);
  assert.equal(await page.locator('#welcome').count(), 0, 'l’écran de bienvenue ne s’affiche qu’après la connexion');
  await page.close();
});
