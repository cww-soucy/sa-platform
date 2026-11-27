'use strict';
// Bons de livraison (27/11/2026) : le numéro d'un bon est son ODT (choisi parmi les ODT existants, doublon signalé),
// et un bon assigné à un livreur apparaît au planning (tâche planning « bl-<id> »), comme les autres travaux.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const A = (page, fn, arg) => page.evaluate(fn, arg);
const ready = (page) => page.waitForFunction(() => window.__admin && window.__admin.D);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label + '$') }) }).locator('input,select,textarea').first();

function tables() {
  const t = base();
  t.bons_livraison = [{ id: 'bl-x', no_bon: '24-5000', client: 'Piscine Beta', adresse: '2 rue B, Lévis', date: today(), heure: '', technicien: 'Autre Tech', urgent: false, status: 'brouillon', items_liv: [], items_ret: [], photos: [] }];
  t.workorders.push({ id: 'wo-odt', client: 'Piscine Alpha', site: '1 rue A, Québec', type: 'reparation', priorite: 'normal', status: 'ouvert', date: today(), heure_debut: '13:30', assigne: 'cwweil', descr: 'Pompe', groupe_id: null, odt: '24-1187' });
  return t;
}

test('bon de livraison : ODT choisi d’un bon de travail → client, adresse, livreur repris ; le bon est au planning du livreur', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('logistique'));
  await page.getByRole('button', { name: /Nouveau bon de livraison/ }).click();
  // la liste propose les ODT connus (bon de travail, facturation, bons de livraison)
  const liste = await A(page, () => window.__admin.vals().odtList.map((o) => o.v));
  assert.ok(liste.includes('24-1187') && liste.includes('ODT-1') && liste.includes('24-5000'), liste.join(','));
  await field(page, 'ODT').fill('24-1187');
  assert.equal(await field(page, 'Client').inputValue(), 'Piscine Alpha');
  assert.equal(await field(page, 'Adresse de livraison').inputValue(), '1 rue A, Québec');
  assert.equal(await field(page, 'Technicien / livreur').inputValue(), 'Bureau SA');
  await dlg(page).getByText(/Lié au bon de travail : Réparation · Piscine Alpha/).waitFor();
  assert.match(await A(page, () => window.__admin.vals().deTitle), /Bon de livraison · ODT 24-1187/);
  await dlg(page).getByLabel('Article', { exact: true }).first().fill('Pompe 1 HP');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /au planning de Bureau SA/);
  const b = db.rows('bons_livraison').find((x) => x.client === 'Piscine Alpha');
  assert.equal(b.no_bon, '24-1187'); // le numéro du bon EST l'ODT
  assert.ok(!('odt' in b));
  const t = db.rows('planning_tasks').find((x) => x.id === 'bl-' + b.id);
  assert.ok(t, 'tâche planning créée');
  assert.equal(t.emp, 'cwweil');
  assert.equal(t.date_debut, today());
  assert.equal(t.heure_debut, '13:30');
  assert.equal(t.titre, 'Livraison · Piscine Alpha');
  assert.match(t.descr, /Bon de livraison ODT 24-1187/);
  assert.match(t.descr, /• Pompe 1 HP/);
  assert.equal(t.statut, 'assigne');
  // la liste des bons affiche l'ODT
  await page.getByText('ODT 24-1187').first().waitFor();
  // Planning équipe : la livraison est dans la journée de Bureau SA
  await A(page, () => window.__admin.go('planning'));
  await page.waitForFunction(() => /Livraison · Piscine Alpha/.test(document.body.innerText));
  // ouvrir la tâche planning ouvre le bon de livraison
  await A(page, (id) => window.__admin.openFE('pt', id), t.id);
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.kind === 'bl');
  // livré → la tâche est terminée
  await dlg(page).getByRole('button', { name: 'Marquer livré' }).click();
  await page.waitForFunction(() => !window.__admin.state.de);
  for (let i = 0; i < 40 && db.rows('planning_tasks').find((x) => x.id === t.id).statut !== 'termine'; i++) await page.waitForTimeout(50);
  assert.equal(db.rows('planning_tasks').find((x) => x.id === t.id).statut, 'termine');
  assert.deepEqual(errors, []);
  await page.close();
});

test('bon de livraison : même ODT déjà sur un autre bon → signalé ; sans livreur → retiré du planning ; supprimé → retiré', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('logistique'));
  // rattrapage : les bons assignés déjà existants entrent au planning
  for (let i = 0; i < 60 && !db.rows('planning_tasks').some((x) => x.id === 'bl-bl-x'); i++) await page.waitForTimeout(50);
  const tx = db.rows('planning_tasks').find((x) => x.id === 'bl-bl-x');
  assert.ok(tx, 'bon existant rattrapé au planning');
  assert.equal(tx.emp, 'kael2');
  await page.getByRole('button', { name: /Nouveau bon de livraison/ }).click();
  await field(page, 'ODT').fill('24-5000');
  await dlg(page).getByText(/Ce même ODT est déjà sur un bon de livraison : brouillon · .* · Autre Tech/).waitFor();
  await dlg(page).getByRole('button', { name: 'Ouvrir ce bon' }).click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.id === 'bl-x');
  assert.equal(await field(page, 'ODT').inputValue(), '24-5000');
  assert.equal(await A(page, () => window.__admin.vals().hasOdtDoublon), false); // pas de doublon avec lui-même
  // plus de livreur → la tâche planning est retirée
  await field(page, 'Technicien / livreur').selectOption('');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Bon de livraison enregistré/);
  for (let i = 0; i < 40 && db.rows('planning_tasks').some((x) => x.id === 'bl-bl-x'); i++) await page.waitForTimeout(50);
  assert.ok(!db.rows('planning_tasks').some((x) => x.id === 'bl-bl-x'));
  // un livreur → revient ; suppression du bon → retirée
  await page.waitForFunction(() => Array.isArray(window.__admin.docs.bl));
  await A(page, () => window.__admin.openDoc('bl', 'bl-x'));
  await field(page, 'Technicien / livreur').selectOption('Kaël Test');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /au planning de Kaël Test/);
  assert.equal(db.rows('planning_tasks').find((x) => x.id === 'bl-bl-x').emp, 'kael');
  await page.waitForFunction(() => Array.isArray(window.__admin.docs.bl));
  await A(page, () => window.__admin.openDoc('bl', 'bl-x'));
  await dlg(page).getByRole('button', { name: 'Supprimer' }).click();
  await dlg(page).getByRole('button', { name: 'Confirmer la suppression' }).click();
  for (let i = 0; i < 40 && db.rows('planning_tasks').some((x) => x.id === 'bl-bl-x'); i++) await page.waitForTimeout(50);
  assert.ok(!db.rows('planning_tasks').some((x) => x.id === 'bl-bl-x'));
  // sans ODT : numéro automatique
  await page.getByRole('button', { name: /Nouveau bon de livraison/ }).click();
  await field(page, 'Client').fill('Piscine Beta');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Bon de livraison enregistré/);
  assert.match(db.rows('bons_livraison').find((x) => x.client === 'Piscine Beta' && x.id !== 'bl-x').no_bon, /^SA-\d{8}-\d{3}$/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('bon de travail avec ODT : signale un ODT déjà utilisé et crée son bon de livraison déjà rempli', async () => {
  const t = tables();
  t.workorders.push({ id: 'wo-odt2', client: 'Piscine Beta', site: '2 rue B, Lévis', type: 'entretien', priorite: 'normal', status: 'ouvert', date: today(), assigne: 'kael', descr: '', groupe_id: null, odt: '24-1187' });
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await ready(page);
  await A(page, () => window.__admin.openFE('wo', 'wo-odt'));
  await page.waitForFunction(() => window.__admin.vals().feReady);
  await dlg(page).getByText(/Cet ODT est déjà sur un autre bon de travail : Piscine Beta/).waitFor();
  await dlg(page).getByRole('button', { name: 'Créer le bon de livraison de cet ODT' }).click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.kind === 'bl');
  assert.equal(await field(page, 'ODT').inputValue(), '24-1187');
  assert.equal(await field(page, 'Client').inputValue(), 'Piscine Alpha');
  assert.equal(await field(page, 'Adresse de livraison').inputValue(), '1 rue A, Québec');
  assert.equal(await field(page, 'Technicien / livreur').inputValue(), 'Bureau SA');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : le bon affiche son ODT, et le livrer termine sa tâche planning', async () => {
  const t = tables();
  t.bons_livraison = [{ id: 'bl-k', no_bon: '24-7777', client: 'Piscine Alpha', adresse: '1 rue A, Québec', date: today(), heure: '09:00', technicien: 'Kaël Test', urgent: false, status: 'brouillon', items_liv: [{ item: 'Chlore', qteSortie: '2' }], items_ret: [], photos: [] }];
  t.planning_tasks = [{ id: 'bl-bl-k', titre: 'Livraison · Piscine Alpha', descr: 'Bon de livraison ODT 24-7777', emp: 'kael', emp_nom: 'Kaël Test', site_id: '1', site_nom: 'Piscine Alpha', date_debut: today(), date_fin: today(), heure_debut: '09:00', heure_fin: '', statut: 'assigne', recurrence: null }];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  await page.waitForFunction(() => window.__terrain && window.__terrain.jobs && window.__terrain.jobs.some((j) => /Livraison · Piscine Alpha/.test(j.tache)));
  await A(page, () => { window.__terrain.vals().goLog(); window.__terrain.setState({ logTab: 'bon' }); });
  await page.getByRole('button', { name: /ODT 24-7777/ }).click();
  await page.getByRole('button', { name: 'Valider sans signature' }).click();
  await page.getByRole('button', { name: 'Confirmer : livré sans signature' }).click();
  await page.waitForFunction(() => !window.__terrain._pend && !JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length);
  for (let i = 0; i < 60 && db.rows('planning_tasks')[0].statut !== 'termine'; i++) await page.waitForTimeout(50);
  assert.equal(db.rows('planning_tasks')[0].statut, 'termine');
  assert.equal(db.rows('bons_livraison')[0].status, 'livre');
  assert.deepEqual(errors, []);
  await page.close();
});

test('impression : le bon porte « ODT … » (numéro automatique inchangé sans ODT)', () => {
  global.window = undefined;
  const SABon = require('../src/impression/bon-livraison.js');
  assert.match(SABon.html({ no_bon: '24-1187', client: 'X', items_liv: [] }), /<h1>ODT 24-1187<\/h1>/);
  assert.match(SABon.html({ no_bon: 'SA-20261127-123', client: 'X', items_liv: [] }), /<h1>SA-20261127-123<\/h1>/);
});
