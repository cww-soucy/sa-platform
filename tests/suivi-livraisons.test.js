'use strict';
// Suivi des livraisons : bons de livraison non livrés (brouillon, à livrer, en route, en retard) au monitoring, à la vue globale,
// aux opérations et dans le dossier du client, avec un gradateur Brouillon → À livrer → En route → Livré ; « Je pars livrer » dans sa-terrain.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const T = (page, fn, arg) => page.evaluate(fn, arg);

function tables() {
  const t = base();
  t.bons_livraison.push(
    { id: 'bl-c', no_bon: 'SA-BROUILLON', client: 'Piscine Alpha', date: '', technicien: '', status: 'brouillon', items_liv: [], items_ret: [], photos: [] },
    { id: 'bl-d', no_bon: 'SA-ROUTE', client: 'Piscine Beta', date: '2026-01-05', technicien: 'Kaël Test', status: 'en_route', items_liv: [{ item: 'Sel 20 kg', qteSortie: '10' }], items_ret: [], photos: [] });
  return t;
}

test('sa-admin : livraisons en cours avec gradateur au monitoring, à la vue globale, aux opérations et au dossier du client', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('monitoring'));
  const panel = page.locator('[data-livraisons]');
  await panel.locator('[data-livraison]').first().waitFor();
  assert.deepEqual(await panel.locator('[data-livraison]').evaluateAll((l) => l.map((e) => e.getAttribute('data-livraison'))), ['SA-ROUTE', 'SA-20260928-111', 'SA-BROUILLON'], 'en retard d’abord, puis par étape ; les bons livrés n’y sont pas');
  assert.match(await panel.innerText(), /1 brouillon\(s\) · 1 à livrer · 1 en route · 1 en retard/);
  const route = panel.locator('[data-livraison="SA-ROUTE"]');
  assert.match(await route.innerText(), /En route · en retard/);
  assert.equal(await route.getByRole('img').getAttribute('aria-label'), 'Étape : En route · en retard');
  assert.match(await panel.locator('[data-livraison="SA-20260928-111"]').innerText(), /À livrer · URGENT[\s\S]*Kaël Test · 1 article/);
  assert.match(await panel.locator('[data-livraison="SA-BROUILLON"]').innerText(), /Brouillon[\s\S]*sans date · non assigné · 0 article/);
  await route.click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.id === 'bl-d');
  await page.evaluate(() => window.__admin.setState({ de: null }));
  // vue globale
  await page.evaluate(() => window.__admin.go('globale'));
  await page.locator('[data-livraisons] [data-livraison]').first().waitFor();
  assert.equal(await page.locator('[data-livraisons] [data-livraison]').count(), 3);
  // opérations : tous les clients, et le dossier du client
  await page.evaluate(() => window.__admin.go('operations'));
  await page.locator('[data-livraisons] [data-livraison]').first().waitFor();
  assert.equal(await page.locator('[data-livraisons] [data-livraison]').count(), 3);
  await page.evaluate(() => { const d = window.__admin.vals().dossiers.find((x) => x.client === 'Piscine Beta'); d.toggle(); });
  const dl = page.locator('[data-dossier-livraisons]');
  await dl.waitFor();
  assert.deepEqual(await dl.locator('[data-livraison]').evaluateAll((l) => l.map((e) => e.getAttribute('data-livraison'))), ['SA-ROUTE', 'SA-20260928-111']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : « Je pars livrer » met le bon en route (suivi au bureau), puis la livraison le marque livré', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await T(page, () => { window.__terrain.vals().goLog(); window.__terrain.setState({ logTab: 'bon' }); });
  await page.getByRole('button', { name: /SA-20260928-111/ }).click();
  await page.getByRole('button', { name: 'Je pars livrer' }).click();
  await page.getByText('En route — le bureau suit la livraison', { exact: true }).waitFor();
  await page.waitForFunction(() => !window.__terrain._pend && !JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length);
  assert.equal(db.rows('bons_livraison').find((b) => b.id === 'bl-a').status, 'en_route');
  assert.equal(await page.getByRole('button', { name: 'Je pars livrer' }).count(), 0);
  await page.getByRole('button', { name: 'Valider sans signature' }).click();
  await page.getByRole('button', { name: 'Confirmer : livré sans signature' }).click();
  await page.waitForFunction(() => !window.__terrain._pend && !JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length);
  assert.equal(db.rows('bons_livraison').find((b) => b.id === 'bl-a').status, 'livre');
  assert.deepEqual(errors, []);
  await page.close();
});
