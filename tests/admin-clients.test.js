'use strict';
// sa-admin — Sites & Clients : un client regroupe plusieurs sites, fusion de sites (tout suit) et classement des lieux saisis à la main dans les punchs.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, weekKey } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');

function tables() {
  const t = base();
  t.sites.push(
    { id: 'q1', nom: 'CCNQ - Quai des Flots', addr: '', notes: '', bassins: [{ id: 'b1', nom: 'Piscine' }], client_id: 'ccnq' },
    { id: 'q2', nom: 'CCNQ - Quai des Flots - Fontainiers', addr: '', notes: '', bassins: [] },
    { id: 'e1', nom: 'Soucy Aquatik - Entrepôt', addr: '', notes: '', client_id: 'sa' });
  t.clients = [{ id: 'ccnq', nom: 'CCNQ', interne: false, notes: '' }, { id: 'sa', nom: 'Soucy Aquatik', interne: true, notes: '' }];
  t.lieux_alias = [];
  const wk = weekKey(), days = t.feuilles_temps[0].days;
  days[0].tasks.push({ id: 2, lieu: 'quai des flots', start: '08:00', end: '09:00', hrs: 1 }, { id: 3, lieu: 'Quai des Flots ', start: '09:00', end: '10:00', hrs: 1 },
    { id: 4, lieu: 'x', siteId: 'q2', start: '10:00', end: '11:00', hrs: 1 });
  t.feuilles_temps[0].week = wk;
  return t;
}

test('clients : sites regroupés par client, rattachement d’un site, nouveau client', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites'));
  const ccnq = page.locator('section[data-client="CCNQ"]');
  await ccnq.locator('tr[data-site="CCNQ - Quai des Flots"]').waitFor();
  assert.match(await ccnq.innerText(), /Piscine/);
  await page.locator('section[data-client="Soucy Aquatik"]').getByText('Soucy Aquatik · interne').waitFor();
  // un site sans client se rattache à un client existant
  const sans = page.locator('section[data-client="Sites sans client"]');
  await sans.locator('tr[data-site="Piscine Beta"]').getByLabel('Client du site').selectOption('ccnq');
  await toast(page, /rattaché à CCNQ/);
  assert.equal(db.rows('sites').find((s) => String(s.id) === '2').client_id, 'ccnq');
  // nouveau client créé depuis la liste d'un site : le site y est rattaché
  await sans.locator('tr[data-site="Piscine Alpha"]').getByLabel('Client du site').selectOption('__new');
  await dlg(page).getByLabel('Nom du client').fill('Ville de Lévis');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /rattaché à Ville de Lévis/);
  const c = db.rows('clients').find((x) => x.nom === 'Ville de Lévis');
  assert.ok(c && c.interne === false);
  assert.equal(db.rows('sites').find((s) => String(s.id) === '1').client_id, c.id);
  await page.locator('section[data-client="Ville de Lévis"] tr[data-site="Piscine Alpha"]').waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('clients : fusion d’un site dans un autre (installation gardée) par la fonction de la base', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  let appel = null;
  db.rpc.site_fusionner = (b, d) => { appel = b; const s = d.rows('sites').find((x) => x.id === b.p_src); s.notes = 'Fusionné → CCNQ - Quai des Flots [q1] le 2026-10-05.'; return { feuilles_temps: 1 }; };
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites'));
  await page.locator('tr[data-site="CCNQ - Quai des Flots - Fontainiers"]').getByLabel('Fusionner dans').selectOption('q1');
  await dlg(page).getByText('sera fusionné dans').waitFor();
  assert.equal(await dlg(page).getByLabel('Nom de l’installation').inputValue(), 'Fontainiers');
  await dlg(page).getByRole('button', { name: 'Fusionner' }).click();
  await toast(page, /fusionné dans « CCNQ - Quai des Flots »/);
  assert.deepEqual(appel, { p_src: 'q2', p_dst: 'q1', p_par: 'cwweil', p_installation: 'Fontainiers' });
  await page.waitForFunction(() => !window.__admin.D.sites.some((s) => s.id === 'q2'));
  assert.ok(db.rows('audit_log').some((a) => a.action === 'FUSION'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('lieux à classer : lieu tapé à la main, suggestion, classement de tous ses punchs', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  let appel = null;
  db.rpc.lieu_classer = (b) => { appel = b; return 1; };
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites', { sitesTab: 'lieux' }));
  const row = page.locator('tr[data-lieu="quai des flots"], tr[data-lieu="Quai des Flots "]');
  await row.waitFor();
  assert.match(await row.innerText(), /2 écritures/);
  // le punch déjà relié (siteId) ne figure pas ; Entrepôt suggère le site interne
  assert.equal(await page.locator('tr[data-lieu="x"]').count(), 0);
  assert.equal(await page.locator('tr[data-lieu="Entrepôt"]').getByRole('combobox').inputValue(), 'e1');
  assert.equal(await row.getByRole('combobox').inputValue(), 'q1');
  await row.getByRole('button', { name: 'Classer' }).click();
  await toast(page, /classé dans « CCNQ - Quai des Flots » \(2 punchs\)/);
  assert.deepEqual(appel.p_lieux.sort(), ['Quai des Flots ', 'quai des flots'].sort());
  assert.equal(appel.p_site, 'q1');
  await page.waitForFunction(() => !document.querySelector('tr[data-lieu="quai des flots"],tr[data-lieu="Quai des Flots "]'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('clients : base pas encore mise à jour → message clair, Répertoire toujours utilisable', async () => {
  const t = tables(); delete t.clients;
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  db.fail.clients = 404;
  await page.evaluate(() => window.__admin.reloadAll());
  await page.evaluate(() => window.__admin.go('sites'));
  await page.getByText('pas encore les fiches clients').waitFor();
  await page.getByRole('tab', { name: 'Répertoire' }).click();
  await page.getByPlaceholder('Rechercher un site…').waitFor();
  assert.deepEqual(errors.filter((e) => !/404/.test(e)), []);
  await page.close();
});
