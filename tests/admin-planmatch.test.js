'use strict';
// sa-admin — Plan de Match (table plan_match partagée avec SA Platform).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const A = (page, fn, arg) => page.evaluate(fn, arg);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
async function pmm(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => window.__admin.go('planmatch'));
  await page.waitForFunction(() => !window.__admin.vals().pmmLoading);
}
const card = (page, nom) => page.locator('section.blueprint', { hasText: nom });

test('vue équipe : plan de chaque employé, progression, travaux du jour', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await pmm(page);
  const c = card(page, 'Kaël Test');
  await c.getByText('1 / 3 tâches').waitFor();
  assert.match(await c.innerText(), /Véhicule : Dodge Promaster[\s\S]*Attention valve fermée[\s\S]*Tests d’eau \(15 min\)[\s\S]*Fait — à valider[\s\S]*Obstacles : Valve grippée[\s\S]*Bon de travail — Piscine Alpha/);
  assert.match(await card(page, 'Autre Tech').innerText(), /Aucun plan pour cette journée/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('créer un plan pour un employé (format SA Platform)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await pmm(page);
  await card(page, 'Autre Tech').getByRole('button', { name: 'Créer le plan' }).click();
  const d = page.locator('.dialog');
  await d.locator('.field', { hasText: 'Véhicule' }).locator('input').fill('Dodge Promaster · ABC 123');
  await d.getByPlaceholder('Ex. Tournée Rive-Sud, fermetures').fill('Fermetures Lévis');
  await d.getByPlaceholder('Titre de la section (ex. SDC3 — ~2 h)').fill('Piscine Beta');
  await d.getByPlaceholder('Tâche…').fill('Hivernage complet');
  await d.getByPlaceholder('min').fill('120');
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Plan de Match créé/);
  const p = db.rows('plan_match').find((x) => x.emp === 'kael2');
  assert.equal(p.resume, 'Fermetures Lévis');
  assert.equal(p.vehicule, 'Dodge Promaster · ABC 123');
  assert.deepEqual(p.sections[0].tasks.map((t) => [t.label, t.est, t.status, t.done]), [['Hivernage complet', '120', 'À faire', false]]);
  await card(page, 'Autre Tech').getByText('0 / 1 tâches').waitFor();
  await page.close();
});

test('modifier un plan garde ce que le technicien a coché entre-temps', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await pmm(page);
  await card(page, 'Kaël Test').getByRole('button', { name: 'Modifier le plan' }).click();
  // pendant ce temps, dans SA Platform, le technicien coche « Nettoyage »
  const row = db.rows('plan_match')[0];
  row.sections[0].tasks[1].done = true; row.sections[0].tasks[1].status = '✅ Fait'; row.updated_at = '2026-01-02T00:00:00Z';
  const d = page.locator('.dialog');
  await d.getByPlaceholder('Titre de la section (ex. SDC3 — ~2 h)').fill('Piscine Alpha — matin');
  await d.getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Plan de Match enregistré/);
  const s = db.rows('plan_match')[0].sections[0];
  assert.equal(s.title, 'Piscine Alpha — matin');
  assert.equal(s.tasks[1].done, true, 'coche du technicien conservée');
  await page.close();
});

test('valider une tâche faite (2e étape du superviseur)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await pmm(page);
  await card(page, 'Kaël Test').getByRole('button', { name: 'Valider' }).click();
  await toast(page, /Tâche validée/);
  const t = db.rows('plan_match')[0].sections[0].tasks[0];
  assert.equal(t.valide, true);
  assert.equal(t.valideBy, 'cwweil');
  await card(page, 'Kaël Test').getByText('Validé', { exact: true }).waitFor();
  await page.close();
});

test('imprimer la journée de l’équipe, puis supprimer un plan (confirmation)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await pmm(page);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Imprimer la journée de l’équipe' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.locator('body').innerText(), /Plan de Match — Kaël Test[\s\S]*☑\s*Tests d’eau[\s\S]*Travaux du jour/);
  await pop.close();
  await card(page, 'Kaël Test').getByRole('button', { name: 'Modifier le plan' }).click();
  await page.locator('.dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  assert.equal(db.rows('plan_match').length, 1);
  await page.locator('.dialog').getByRole('button', { name: 'Confirmer la suppression' }).click();
  await toast(page, /supprimé/);
  assert.equal(db.rows('plan_match').length, 0);
  await page.close();
});

test('Plan de Match : activité réelle — punch en cours, travaux en cours / à faire / en retard, non assignés', async () => {
  const { dayIdx, iso, addDays, today } = require('./harness');
  const t = base();
  t.feuilles_temps[0].days[dayIdx()].tasks.push({ id: 2, lieu: 'Piscine Alpha', start: '08:30', end: '', hrs: 0, active: true, sourceId: 'wo-mine', sourceLabel: 'WO — Piscine Alpha' });
  t.workorders.push({ id: 'wo-late', client: 'Piscine Gamma', site: '', type: 'reparation', priorite: 'normal', status: 'ouvert', date: iso(addDays(new Date(), -3)), assigne: 'kael', descr: 'Valve', groupe_id: null });
  t.workorders.push({ id: 'wo-una', client: 'Piscine Delta', site: '', type: 'entretien', priorite: 'normal', status: 'ouvert', date: today(), assigne: '', descr: '', groupe_id: null });
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('planmatch'));
  await page.getByText('Travaux sans personne assignée').waitFor();
  await page.getByText('En punch : Piscine Alpha depuis 08:30 — WO — Piscine Alpha').waitFor();
  const c = await page.evaluate(() => { const k = window.__admin.vals().pmmCards[0]; return { nom: k.nom, cur: k.jobsCur.map((j) => j.txt), late: k.jobsLate.map((j) => j.txt) }; });
  assert.equal(c.nom, 'Kaël Test', 'l’employé en punch passe en premier');
  assert.deepEqual(c.cur, ['Bon de travail — Piscine Alpha — Entretien hebdo']);
  assert.match(c.late[0], /Piscine Gamma/);
  assert.deepEqual(await page.evaluate(() => window.__admin.vals().pmmSum.map((k) => k.v)), ['1 / 2', '0 / 2', '1', '1', '1']);
  await page.getByRole('button', { name: /Piscine Delta/ }).click();
  await page.locator('.dialog').getByText('Liste de tâches').waitFor();
  assert.equal(await page.evaluate(() => window.__admin.state.fe.id), 'wo-una');
  assert.deepEqual(errors, []);
  await page.close();
});
