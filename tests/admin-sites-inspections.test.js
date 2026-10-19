'use strict';
// sa-admin — Sites et inspections : une seule catégorie (une entrée de menu, une barre d'onglets commune, liens croisés).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.clients = [{ id: 'cv', nom: 'Ville X', interne: false, notes: '' }];
  t.sites[0].client_id = 'cv'; t.sites[1].client_id = 'cv';
  t.lieux_alias = [];
  return t;
}

test('une seule entrée « Sites et inspections » et une barre d’onglets commune', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const nav = await page.evaluate(() => window.__admin.vals().navGroups.flatMap((g) => g.items.map((i) => i.label)));
  assert.ok(nav.includes('Sites et inspections'));
  assert.ok(!nav.includes('Inspections') && !nav.includes('Sites'));
  await page.getByRole('button', { name: /Sites et inspections/ }).first().click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'inspections');
  const bar = page.getByRole('tablist', { name: 'Sites et inspections' });
  assert.deepEqual(await bar.getByRole('tab').allTextContents(), ['Inspections et rapports', 'Clients et sites', 'Lieux à classer', 'Répertoire']);
  await bar.getByRole('tab', { name: 'Clients et sites' }).click();
  assert.deepEqual(await page.evaluate(() => [window.__admin.state.mod, window.__admin.state.sitesTab]), ['sites', 'clients']);
  assert.equal(await bar.getByRole('tab', { name: 'Clients et sites' }).getAttribute('aria-selected'), 'true');
  await bar.getByRole('tab', { name: 'Répertoire' }).click();
  assert.equal(await page.evaluate(() => window.__admin.state.sitesTab), 'rep');
  // l'entrée du menu reste en surbrillance et rouvre le dernier écran utilisé
  await page.evaluate(() => window.__admin.go('monitoring'));
  await page.getByRole('button', { name: /Sites et inspections/ }).first().click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'sites');
  assert.deepEqual(errors, []);
  await page.close();
});

test('liens croisés : état d’inspection dans la liste des sites, « Fiche du site » depuis l’inspection', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites', { sitesTab: 'clients' }));
  const btn = page.getByRole('button', { name: 'Inspections de Piscine Beta' });
  await btn.waitFor();
  assert.match(await btn.innerText(), /Aucune visite|Visite du/);
  await btn.click();
  assert.deepEqual(await page.evaluate(() => [window.__admin.state.mod, window.__admin.state.inspSite]), ['inspections', '2']);
  await page.getByRole('heading', { name: 'Piscine Beta' }).waitFor();
  await page.getByRole('button', { name: 'Fiche du site' }).click();
  await page.waitForFunction(() => { const v = window.__admin.vals(); return v.sfOpen && v.sfTitle === 'Piscine Beta'; });
  assert.deepEqual(errors, []);
  await page.close();
});
