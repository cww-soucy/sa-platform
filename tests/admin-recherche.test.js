'use strict';
// sa-admin — recherche du haut (« Site, client, dossier, ODT… ») : résultats pendant la frappe, sans Entrée.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('taper « beau » sans Entrée affiche les résultats ; Échap ferme ; un clic ouvre Sites et inspections sur ce site', async () => {
  const t = base();
  t.sites.push({ id: 7, nom: 'Piscine Beauport', addr: '7 rue C, Québec', notes: '' });
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const q = page.getByPlaceholder('Site, client, dossier, ODT…');
  await q.click();
  await q.pressSequentially('beau', { delay: 30 });
  const res = page.locator('header').getByRole('button', { name: /Piscine Beauport/ });
  await res.waitFor();
  assert.equal(await q.inputValue(), 'beau', 'le texte tapé reste intact pendant la frappe');
  await q.press('Escape');
  await res.waitFor({ state: 'detached' });
  await q.pressSequentially('p', { delay: 30 });
  await q.fill('beau'); // fill déclenche aussi « input »
  await res.click();
  await page.waitForFunction(() => window.__admin.state.mod === 'inspections');
  assert.equal(String(await page.evaluate(() => window.__admin.state.inspSite)), '7');
  assert.equal(await page.locator('header').getByRole('button', { name: /Piscine Beauport/ }).count(), 0, 'liste fermée après le clic');
  assert.deepEqual(errors, []);
  await page.close();
});
