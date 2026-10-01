'use strict';
// sa-admin — Monitoring : relevés d'hier / 7 jours visibles, salles mécaniques réelles, mur de contrôle grand écran.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, dayIdx, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.feuilles_temps[0].days[dayIdx()].tasks.push({ id: 2, lieu: 'Piscine Alpha', start: '08:30', end: '', hrs: 0, active: true, siteId: 1 });
  t.releves.push({ id: 'r2', site_id: 2, site_nom: 'Piscine Beta', tech: 'kael2', tech_nom: 'Autre Tech', date: iso(addDays(new Date(), -9)), heure: '14:00', type_code: 'GEN', vals: {}, touched: {}, checks: {}, prods: {}, note: null });
  return t;
}

test('monitoring : les relevés d’hier apparaissent (période), salles mécaniques remplies', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByText('Aucun relevé aujourd’hui.').waitFor();
  await page.getByRole('button', { name: 'Hier', exact: true }).click();
  await page.getByText('Relevés hier (1)').waitFor();
  await page.getByRole('row', { name: /Piscine Alpha.*Kaël Test.*2 valeur\(s\).*1 hors zone/ }).waitFor();
  await page.getByRole('button', { name: '7 derniers jours' }).click();
  await page.getByText('Relevés sur 7 jours (1)').waitFor();
  const s = await page.evaluate(() => window.__admin.vals().salles.map((x) => [x.nom, x.etat, x.hasLive]));
  assert.deepEqual(s, [['Piscine Alpha', '1 valeur(s) hors zone', true], ['Piscine Beta', 'Aucun relevé depuis 9 j', false]]);
  await page.getByText('Sur place : Kaël Test depuis 08:30').first().waitFor();
  // clic sur un relevé → Inspections du site
  await page.getByRole('row', { name: /Piscine Alpha.*Kaël Test.*valeur/ }).click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'inspections');
  assert.deepEqual(errors, []);
  await page.close();
});

test('mur de contrôle : grand écran avec indicateurs, salles, équipe et flux', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByRole('button', { name: /Mur de contrôle/ }).click();
  const wall = page.getByRole('dialog', { name: 'Mur de contrôle' });
  await wall.getByText('Salles mécaniques').waitFor();
  await wall.getByText('Kaël Test', { exact: true }).waitFor();
  await wall.getByText('Sur place : Kaël Test depuis 08:30').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__admin.vals().wallKpis.map((k) => k.l + '=' + k.v)),
    ['En punch=1', 'Relevés aujourd’hui=0', 'Salles hors zone=1', 'Bons de travail du jour=0 / 2', 'Demandes ouvertes=1']);
  await wall.getByRole('button', { name: 'Quitter' }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Mur de contrôle' }).count(), 0);
  await page.close();
});
