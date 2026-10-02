'use strict';
// sa-admin — Planning › Séries récurrentes : liste, modifier les éléments à venir, arrêter la série.
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
  const t = base(), d = (n) => iso(addDays(new Date(), n)), rec = { serie: 'S1', freq: 'hebdo' };
  t.planning_tasks = [
    { id: 'a', titre: 'Relevés RQEP', emp: 'kael', site_nom: 'Piscine Alpha', date_debut: d(-7), date_fin: d(-7), heure_debut: '08:00', statut: 'termine', recurrence: rec },
    { id: 'b', titre: 'Relevés RQEP', emp: 'kael', site_nom: 'Piscine Alpha', date_debut: d(7), date_fin: d(7), heure_debut: '08:00', statut: 'assigne', recurrence: rec },
    { id: 'c', titre: 'Relevés RQEP', emp: 'kael', site_nom: 'Piscine Alpha', date_debut: d(14), date_fin: d(14), heure_debut: '08:00', statut: 'assigne', recurrence: rec },
  ];
  return t;
}
async function open(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('planning'));
  await page.getByRole('button', { name: 'Séries récurrentes' }).click();
  await page.getByRole('row', { name: /Relevés RQEP/ }).waitFor();
}

test('séries : liste avec règle, prochaine date, employés', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  const r = await page.evaluate(() => window.__admin.vals().srRows.find((x) => x.titre === 'Relevés RQEP'));
  assert.equal(r.qui, 'Kaël Test');
  assert.match(r.etat, /^2 à venir · prochaine le /);
  assert.match(r.regle, /^chaque semaine · /);
  assert.deepEqual(errors, []);
  await page.close();
});

test('séries : modifier les à venir (heure, employés) sans toucher aux terminés ; arrêter la série', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByRole('row', { name: /Relevés RQEP/ }).getByRole('button', { name: 'Gérer' }).click();
  await dlg(page).locator('input[type=time]').fill('09:30');
  await dlg(page).getByRole('button', { name: /Autre Tech/ }).click();
  await dlg(page).getByRole('button', { name: 'Modifier les éléments à venir' }).click();
  await toast(page, /2 élément\(s\) à venir modifié\(s\)/);
  const rows = db.rows('planning_tasks');
  assert.deepEqual(rows.map((x) => [x.id, x.heure_debut, x.emp]), [['a', '08:00', 'kael'], ['b', '09:30', 'kael, kael2'], ['c', '09:30', 'kael, kael2']]);
  await page.getByRole('row', { name: /Relevés RQEP/ }).getByRole('button', { name: 'Gérer' }).click();
  await dlg(page).getByRole('button', { name: 'Arrêter la série à partir de cette date' }).click();
  await dlg(page).getByRole('button', { name: /Confirmer : supprimer/ }).click();
  await toast(page, /Série arrêtée : 2 élément\(s\) supprimé\(s\)/);
  assert.deepEqual(db.rows('planning_tasks').map((x) => x.id), ['a'], 'l’occurrence terminée est conservée');
  await page.close();
});
