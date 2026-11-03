'use strict';
// Créneau horaire (début / fin) et ordre d'exécution sur les bons de travail, créneaux et tâches planning (02/11/2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label + '$') }) }).locator('input,select,textarea').first();
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);

test('sa-admin : heure début, heure fin et ordre sur un bon de travail, un créneau et une tâche', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  // Bon de travail existant
  await page.evaluate(() => window.__admin.openFE('wo', 'wo-mine'));
  await dlg(page).getByText('Liste de tâches').waitFor();
  await field(page, 'Heure début').fill('09:00');
  await field(page, 'Heure fin').fill('08:00');
  await field(page, 'Ordre').fill('2');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /L’heure de fin doit suivre/);
  await field(page, 'Heure fin').fill('10:30');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Bon de travail enregistré/);
  const w = db.rows('workorders').find((x) => x.id === 'wo-mine');
  assert.deepEqual([w.heure_debut, w.heure_fin, w.ordre], ['09:00', '10:30', 2]);
  // Rouvert : les valeurs reviennent
  await page.evaluate(() => window.__admin.openFE('wo', 'wo-mine'));
  await dlg(page).getByText('Liste de tâches').waitFor();
  assert.equal(await field(page, 'Ordre').inputValue(), '2');
  assert.equal(await field(page, 'Heure fin').inputValue(), '10:30');
  await dlg(page).getByRole('button', { name: 'Annuler' }).click();
  // Nouveau créneau
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  await field(page, 'Client / site').fill('Piscine Beta');
  await dlg(page).getByRole('button', { name: /Kaël Test/ }).click();
  await field(page, 'Heure début').fill('13:00');
  await field(page, 'Heure fin').fill('14:00');
  await field(page, 'Ordre').fill('1');
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Créneau créé/);
  const p = db.rows('plan')[0];
  assert.deepEqual([p.heure, p.heure_fin, p.ordre], ['13:00', '14:00', 1]);
  // Nouvelle tâche planning sans ordre : ordre null
  await page.evaluate(() => window.__admin.openFE('pt', null, { tech: 'kael' }));
  await field(page, 'Titre').fill('Relevés RQEP');
  await field(page, 'Heure début').fill('07:30');
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Tâche planning créée/);
  const t = db.rows('planning_tasks')[0];
  assert.equal(t.heure_debut, '07:30');
  assert.equal(t.ordre, null);
  // Plan de match / tournée du jour : ordre d'abord, puis l'heure
  const jobs = await page.evaluate((d) => new Promise((ok) => { const a = window.__admin; a.pl = {}; a._pl = {}; a.dayJobs('kael', d); setTimeout(() => ok(a.dayJobs('kael', d).map((j) => [j.kind, j.h])), 400); }), today());
  assert.deepEqual(jobs, [['plan', '1. 13:00–14:00'], ['wo', '2. 09:00–10:30'], ['pt', '07:30']]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : la tournée suit l’ordre du superviseur, puis l’heure, et affiche le créneau', async () => {
  const t = base(), d = today();
  t.workorders.find((w) => w.id === 'wo-mine').heure_debut = '08:00';
  t.workorders.find((w) => w.id === 'wo-mine').ordre = 3;
  t.plan = [{ id: 'pl1', client: 'Piscine Beta', addr: '2 rue B, Lévis', site_id: 2, date: d, heure: '15:00', heure_fin: '16:00', ordre: 1, emp: 'kael', type: 'entretien', status: 'assigned' }];
  t.planning_tasks = [{ id: 'pt1', titre: 'Piscine Alpha Sud', site_nom: 'Piscine Alpha Sud', emp: 'kael', date_debut: d, date_fin: d, heure_debut: '07:00', heure_fin: '', statut: 'assigne' }];
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  await page.waitForFunction(() => window.__terrain && window.__terrain.jobs && window.__terrain.jobs.length === 3);
  const ids = await page.evaluate(() => window.__terrain.jobs.map((j) => [j.id.split(':')[0], j.hl]));
  assert.deepEqual(ids, [['pl', '1. 15:00–16:00'], ['wo', '3. 08:00'], ['pt', '07:00']]);
  await page.waitForFunction(() => /1\. 15:00–16:00/.test(document.body.innerText));
  assert.deepEqual(errors, []);
  await page.close();
});

test('bon prolongé : le jour 1 suit le créneau du bon, chaque journée de plus garde ses heures', async () => {
  const t = base(), d = today(), d1 = iso(addDays(new Date(), 1));
  Object.assign(t.workorders.find((w) => w.id === 'wo-mine'), { heure_debut: '09:00', heure_fin: '11:00', ordre: 1 });
  t.planning_tasks = [{ id: 'suite1', titre: 'Piscine Alpha', descr: 'Suite du bon de travail', site_nom: 'Piscine Alpha', emp: 'kael', wo_id: 'wo-mine', date_debut: d1, date_fin: d1, heure_debut: '13:00', heure_fin: '15:00', statut: 'assigne' }];
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const r = await page.waitForFunction((L) => { const a = window.__admin, x = L.map((dd) => a.dayJobs('kael', dd).filter((j) => j.id === 'wo-mine').map((j) => j.h)); return x.every((y) => y.length) ? x : null; }, [d, d1]).then((h) => h.jsonValue());
  assert.deepEqual(r, [['1. 09:00–11:00'], ['13:00–15:00']]);
  await page.evaluate(() => window.__admin.openFE('wo', 'wo-mine'));
  await dlg(page).getByText(/Créneau du bon : 1\. 09:00–11:00/).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});
