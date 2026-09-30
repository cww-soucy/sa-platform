'use strict';
// sa-admin — portail d'accueil : SA Platform, sa-admin, Temps · Paie, sa-terrain.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Charles', nom: 'Weil', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('portail : affiché après la connexion, avec les compteurs réels, et mène à Temps · Paie', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base(), portail: true });
  await page.getByText(/^(Bonjour|Bon après-midi|Bonsoir) Charles$/).waitFor();
  for (const t of ['SA Platform', 'sa-admin', 'Temps · Paie', 'sa-terrain']) await page.getByRole('dialog').getByText(t, { exact: true }).waitFor();
  await page.waitForFunction(() => window.__admin.D);
  await page.getByText(/\d+ punchs? à valider/).waitFor();
  await page.getByRole('button', { name: 'Ouvrir Temps · Paie' }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Portail Soucy Aquatik' }).count(), 0);
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'temps');
  assert.match(page.url(), /#temps$/);
  // retour au portail par « Accueil »
  await page.getByRole('button', { name: /Accueil · toutes les applications/ }).click();
  await page.getByRole('button', { name: 'Entrer dans sa-admin' }).click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'monitoring');
  assert.deepEqual(errors, []);
  await page.close();
});

test('portail : SA Platform et sa-terrain (session sa-terrain préparée avec le même compte)', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base(), portail: true });
  await page.getByRole('button', { name: 'Ouvrir sa-terrain' }).click();
  await page.waitForURL(/terrain\.html$/);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('sa_terrain_user'))).id, 'cwweil');
  await page.goto(srv.url + '/admin.html');
  await page.getByRole('button', { name: 'Ouvrir SA Platform' }).click();
  await page.waitForURL(/index\.html$/);
  await page.close();
});

test('portail : lien direct admin.html#stock et option « ouvrir directement sa-admin »', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base(), portail: true });
  await page.getByLabel(/ouvrir directement sa-admin/).check();
  assert.equal(await page.evaluate(() => localStorage.getItem('sa_admin_portail')), 'off');
  await page.reload();
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  assert.equal(await page.evaluate(() => window.__admin.state.portail), false);
  await page.evaluate(() => localStorage.setItem('sa_admin_portail', 'on'));
  await page.goto(srv.url + '/admin.html#stock');
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  assert.equal(await page.evaluate(() => window.__admin.state.portail), false);
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'stock');
  await page.close();
});
