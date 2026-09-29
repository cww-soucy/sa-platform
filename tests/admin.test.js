'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, dayIdx } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function ready(page) { await page.waitForFunction(() => window.__admin && window.__admin.D); }
const main = (page) => page.locator('main').innerText();

test('chaque module s’affiche sans erreur JavaScript', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  for (const mod of ['monitoring', 'carte', 'inspections', 'operations', 'planning', 'sites', 'facturation', 'sondages', 'communication', 'temps']) {
    await page.evaluate((m) => window.__admin.go(m), mod);
    await page.waitForTimeout(150);
    assert.ok((await main(page)).trim().length > 0, mod + ' : écran vide');
  }
  for (const tab of ['temps', 'suivi', 'cumul']) { await page.evaluate((t) => { window.__admin.go('temps'); window.__admin.setState({ tempsTab: t }); }, tab); }
  assert.deepEqual(errors, []);
  assert.ok(!(await page.locator('[role=alert]').count()), 'aucun bandeau d’erreur quand tout se charge');
  await page.close();
});

test('carte : vraie carte Leaflet dans le panneau, sans iframe de maquette ni unpkg', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await page.evaluate(() => window.__admin.go('carte'));
  await page.waitForSelector('#mapSlot .leaflet-container');
  assert.equal(await page.locator('iframe').count(), 0);
  const box = await page.locator('#mapSlot .leaflet-container').boundingBox();
  assert.ok(box.width > 300 && box.height > 300, 'carte trop petite : ' + JSON.stringify(box));
  // 2 sites + 2 techniciens punchés aujourd'hui
  assert.equal(await page.locator('#mapSlot .leaflet-interactive').count(), 4);
  await page.evaluate(() => { window.__admin.setState({ carteView: 'schema' }); window.__admin.setState({ carteView: 'geo' }); });
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#mapSlot .leaflet-interactive').count(), 4, 'la carte survit au changement de vue');
  assert.deepEqual(errors, []);
  await page.close();
});

test('une table illisible affiche un bandeau (plus d’écran vide silencieux), et Réessayer le retire', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base(), fail: { facturation: 500 } });
  await ready(page);
  const alert = page.locator('[role=alert]');
  await alert.waitFor();
  assert.match(await alert.innerText(), /facturation \(HTTP 500\)/);
  delete db.fail.facturation;
  await alert.getByRole('button', { name: 'Réessayer' }).click();
  await alert.waitFor({ state: 'detached' });
  await page.close();
});

test('réseau coupé au démarrage : message clair au lieu d’un chargement infini', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base(), fail: { sites: 'network' } });
  await page.waitForFunction(() => /réseau injoignable/.test(document.body.innerText));
  await page.close();
});

test('rechargement qui échoue alors que des données sont affichées : « Hors ligne » et heure de la dernière lecture', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  db.fail.sites = 'network';
  await page.evaluate(() => window.__admin.reloadAll());
  await page.locator('[role=alert]').waitFor();
  assert.match(await page.locator('[role=alert]').innerText(), /dernière lecture réussie à \d\d:\d\d/);
  assert.match(await page.locator('body').innerText(), /Hors ligne ·/);
  await page.close();
});

test('Suivi : corriger seulement l’heure d’entrée recalcule les heures du punch', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await page.evaluate(() => { const a = window.__admin; a.go('temps'); a.setState({ tempsTab: 'suivi' }); a.vals().punchRows[0].fix(); a.setState({ fx: Object.assign({}, a.state.fx, { entree2: '06:30' }) }); a.saveFix(); });
  await page.waitForFunction(() => /Punch corrigé/.test(document.body.innerText));
  const t = db.rows('feuilles_temps')[0].days[dayIdx()].tasks[0];
  assert.equal(t.start, '06:30');
  assert.equal(t.end, '08:00');
  assert.equal(t.hrs, 1.5, 'les heures doivent suivre la nouvelle entrée');
  assert.equal(t.pendingValidation, false);
  assert.ok(t.k && t.k0 === '07:00|Entrepôt' && t.mod > 0, 'protocole SA Platform : sinon le téléphone de l’employé annule la correction');
  await page.close();
});

test('Suivi : heure invalide refusée avant tout envoi', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await page.evaluate(() => { const a = window.__admin; a.vals().punchRows[0].fix(); a.setState({ fx: Object.assign({}, a.state.fx, { entree2: '7h' }) }); a.saveFix(); });
  await page.waitForFunction(() => /Heure d’entrée invalide/.test(document.body.innerText));
  assert.equal(db.writes('feuilles_temps').length, 0);
  await page.close();
});

test('Suivi : valider un punch fonctionne aussi quand updated_at est NULL (plus de faux « conflit »)', async () => {
  const tables = base(); tables.feuilles_temps[0].updated_at = null;
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await ready(page);
  await page.evaluate(() => window.__admin.vals().punchRows[0].ok());
  await page.waitForFunction(() => /Punch validé/.test(document.body.innerText));
  assert.match(db.writes('feuilles_temps')[0].query, /updated_at=is\.null/);
  assert.equal(db.rows('feuilles_temps')[0].days[dayIdx()].tasks[0].validatedBy, 'cwweil');
  await page.close();
});

test('Monitoring : le flux met les événements d’aujourd’hui avant ceux d’hier', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  const flux = await page.evaluate(() => window.__admin.vals().flux.map((f) => f.txt));
  assert.deepEqual(flux, ['Punch', 'Punch', 'Matériel — Trousse DPD']);
  await page.close();
});

test('Monitoring : la photo jointe à une demande s’ouvre à la demande (jamais chargée avec la liste)', async () => {
  const tables = base(); Object.assign(tables.demandes[0], { has_photo: true, photo: 'data:image/png;base64,iVBORw0KGgo=' });
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await ready(page);
  assert.ok(!db.log.some((l) => l.table === 'demandes' && /select=[^&]*\bphoto\b/.test(l.query)), 'la liste ne charge pas les photos');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Voir la photo jointe' }).click()]);
  await popup.waitForSelector('img');
  assert.equal(await popup.locator('img').getAttribute('src'), 'data:image/png;base64,iVBORw0KGgo=');
  await page.close();
});

test('Temps : navigation limitée aux semaines réellement chargées', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  const off = await page.evaluate(() => { const a = window.__admin; for (let i = 0; i < 12; i++) a.vals().tPrev(); return a.state.tOff; });
  assert.equal(off, -7);
  await page.close();
});
