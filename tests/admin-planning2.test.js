'use strict';
// sa-admin — Planning : calendrier 4 semaines et diagramme des travaux (8 semaines, imprimable A3), comme SA Platform.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, addDays, today } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.planning_tasks = [{ id: 'pt1', titre: 'Fermeture saison', emp: 'kael', site_nom: 'Piscine Beta', date_debut: today(), date_fin: iso(addDays(new Date(), 9)), heure_debut: '08:00', statut: 'assigne' }];
  t.plan = [{ id: 'p1', client: 'Piscine Alpha', date: iso(addDays(new Date(), 2)), heure: '13:00', emp: 'kael2', descr: 'Balancement', status: 'assigned' }];
  return t;
}

test('planning 4 semaines : chaque jour liste ses travaux ; un clic ouvre l’éditeur', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('planning'));
  await page.getByRole('button', { name: '4 semaines' }).click();
  await page.waitForFunction(() => (window.__admin.vals().p2Weeks || []).length === 4);
  const n = await page.evaluate(() => window.__admin.vals().p2Weeks.flatMap((w) => w.days).filter((d) => d.items.some((i) => /Fermeture saison/.test(i.txt))).length);
  assert.equal(n, 10, 'la tâche de 10 jours apparaît chaque jour');
  await page.getByRole('button', { name: /13:00 Piscine Alpha/ }).click();
  await page.locator('.dialog').getByText('Créneau', { exact: false }).first().waitFor();
  assert.equal(await page.evaluate(() => window.__admin.state.fe.id), 'p1');
  assert.deepEqual(errors, []);
  await page.close();
});

test('diagramme des travaux : une ligne par chantier, barres sur 8 semaines, impression A3', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => { window.__admin.go('planning'); window.__admin.setState({ pView: 'gantt' }); });
  await page.waitForFunction(() => (window.__admin.vals().gRows || []).length > 0);
  const rows = await page.evaluate(() => window.__admin.vals().gRows.map((r) => r.label + ':' + r.bars.length));
  assert.deepEqual(rows.sort(), ['Piscine Alpha:2', 'Piscine Beta:2']);
  assert.equal(await page.evaluate(() => window.__admin.vals().gWeeks.length), 8);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Imprimer (A3 paysage)' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.content(), /size:A3 landscape/);
  assert.match(await pop.locator('body').innerText(), /Diagramme des travaux[\s\S]*Piscine Beta[\s\S]*Fermeture saison/);
  await pop.close();
  await page.close();
});
