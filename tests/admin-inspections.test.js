'use strict';
// sa-admin — Inspections : relevés par bassin, rapport imprimable, Excel, paramètres de relevé modifiables.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');

function tables() {
  const t = base();
  t.sites[0].bassins = [{ id: 'b1', nom: 'Bassin principal', type: 'piscine', type_code: 'MI' }, { id: 'b2', nom: 'Pataugeoire', type: 'pataugeoire', type_code: 'GEN' }];
  t.releves.push({ id: 'r3', site_id: 1, site_nom: 'Piscine Alpha', tech: 'kael', tech_nom: 'Kaël Test', date: iso(addDays(new Date(), -2)), heure: '11:00', type_code: 'GEN', bassin: 'Pataugeoire', vals: { ph: 7.5, cl: 0.4 }, touched: { ph: 1, cl: 1 }, checks: {}, prods: {}, note: 'Chlore bas' });
  return t;
}
async function open(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: '1', inspKey: null }));
}

test('inspections : un onglet par bassin, relevés et paramètres propres au bassin', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByRole('button', { name: 'Pataugeoire', exact: true }).waitFor();
  const a = await page.evaluate(() => { const v = window.__admin.vals(); return { rows: v.inspTable.rows.length, b: v.insp.bassin }; });
  assert.deepEqual(a, { rows: 1, b: 'Bassin principal (2 bassins)' }, 'le 1er bassin garde les anciens relevés sans bassin');
  await page.getByRole('button', { name: 'Pataugeoire', exact: true }).click();
  const b = await page.evaluate(() => { const v = window.__admin.vals(); return { rows: v.inspTable.rows.map((r) => r.cells.map((c) => c.v)), type: v.insp.typeLabel }; });
  assert.deepEqual(b.rows, [['7,5', '0,4']]);
  assert.match(b.type, /Bassin générique/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('inspections : rapport imprimable (tous les bassins) et export Excel', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Rapport imprimable / PDF' }).click()]);
  await pop.waitForLoadState();
  const txt = await pop.locator('body').innerText();
  assert.match(txt, /Rapport d’inspection — Piscine Alpha/);
  assert.match(txt, /Bassin principal — Piscine municipale intérieure[\s\S]*Pataugeoire — Bassin générique[\s\S]*Chlore bas/);
  await pop.close();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel', exact: true }).click()]);
  assert.match(dl.suggestedFilename(), /^SoucyAquatik_Releves_Piscine_Alpha_.*\.xlsx$/);
  await page.close();
});

test('paramètres de relevé : l’admin modifie une plage (validation) et crée un type', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByRole('button', { name: 'Paramètres de relevé' }).click();
  await dlg(page).getByText('Paramètres mesurés').waitFor();
  const lo = dlg(page).getByLabel('Zone basse').first();
  await lo.fill('9');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /il faut min ≤ zone basse ≤ zone haute ≤ max/);
  await lo.fill('7.0');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Paramètres enregistrés/);
  assert.equal(db.rows('types_bassin').find((x) => x.code === 'MI').fields[0].lo, 7);
  await page.getByRole('button', { name: 'Paramètres de relevé' }).click();
  await dlg(page).locator('select').first().selectOption('__new');
  await dlg(page).getByRole('textbox').first().waitFor();
  await dlg(page).locator('.field', { hasText: 'Code' }).locator('input').fill('SPA');
  await dlg(page).locator('.field', { has: page.locator('label', { hasText: /^Nom$/ }) }).locator('input').fill('Spa commercial');
  await dlg(page).getByRole('button', { name: '+ Ajouter un paramètre' }).click();
  await dlg(page).getByLabel('Nom', { exact: true }).last().fill('Brome');
  await dlg(page).getByRole('button', { name: 'Créer le type' }).click();
  await toast(page, /Paramètres enregistrés/);
  const t = db.rows('types_bassin').find((x) => x.code === 'SPA');
  assert.equal(t.label, 'Spa commercial');
  assert.equal(t.fields[0].label, 'Brome');
  await page.close();
});

test('bureau / entrepôt : ni dans les inspections ni dans les relevés (ce ne sont pas des bassins)', async () => {
  const t = base();
  t.sites.push({ id: 7, nom: 'Soucy Aquatik - Entrepôt', addr: '925 av Newton', notes: '', type: 'autre' }, { id: 8, nom: 'Atelier Lévis', addr: '', notes: '', type: 'interne' });
  t.releves.push({ id: 'rx', site_id: 7, site_nom: 'Soucy Aquatik - Entrepôt', tech: 'kael', tech_nom: 'Kaël Test', date: iso(new Date()), heure: '15:04', type_code: 'GEN', vals: { ph: 6.9 }, touched: { ph: 1 }, checks: {}, prods: {}, hors_zone: 1 });
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const r = await page.evaluate(() => { window.__admin.go('inspections'); const v = window.__admin.vals(); return { rel: window.__admin.D.rel.map((x) => x.id), sites: (v.inspSites || []).map((s) => JSON.stringify(s)) }; });
  assert.ok(!r.rel.includes('rx'), 'le relevé fait à l’entrepôt est ignoré');
  assert.ok(!r.sites.some((n) => /Entrepôt|Atelier Lévis/.test(n)), 'bureau / entrepôt absents de la liste des inspections');
  await page.evaluate(() => { window.__admin.go('sites'); window.__admin.openSiteFiche('8'); });
  await page.waitForFunction(() => { const v = window.__admin.vals(); return v.sfTypes && v.sfTypes.some((o) => o.sel && o.v === 'interne'); });
  const types = await page.evaluate(() => window.__admin.vals().sfTypes.map((o) => o.l + (o.sel ? ' *' : '')));
  assert.ok(types.includes('Bureau / entrepôt (aucun bassin, pas de relevé) *'));
  assert.deepEqual(errors, []);
  await page.close();
});
