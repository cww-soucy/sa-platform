'use strict';
// sa-admin — éditeur complet des bons de travail, créneaux et tâches planning (champs de SA Platform).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const A = (page, fn, arg) => page.evaluate(fn, arg);
async function ready(page) { await page.waitForFunction(() => window.__admin && window.__admin.D); }
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).locator('input,select,textarea').first();

test('bon de travail : modifier statut, tâches, techniciens et exigences (format SA Platform)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => { window.__admin.go('operations'); window.__admin.openFE('wo', 'wo-mine'); });
  await dlg(page).getByText('Liste de tâches').waitFor();
  await field(page, 'Statut').selectOption('complete');
  await dlg(page).getByPlaceholder('Ajouter une tâche…').fill('Vérifier le skimmer');
  await dlg(page).getByRole('button', { name: 'Ajouter', exact: true }).click();
  await dlg(page).getByRole('button', { name: /Autre Tech/ }).click();
  await dlg(page).getByLabel('Photo').check();
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Bon de travail enregistré/);
  const w = db.rows('workorders').find((x) => x.id === 'wo-mine');
  assert.equal(w.status, 'complete');
  assert.deepEqual(w.tasks.map((t) => [t.label, t.done]), [['Vérifier le skimmer', false]]);
  assert.equal(w.assigne, 'kael, kael2');
  assert.deepEqual(w.assignes, ['kael', 'kael2']);
  assert.equal(w.req_photo, true);
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'workorders' && a.action === 'MODIFICATION'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('bon de travail : nouveau dossier sur 3 jours = 3 visites liées (groupe), colonnes réelles', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.openFE('wo', null, {}));
  await field(page, 'Client').fill('Piscine Beta');
  assert.equal(await field(page, 'Site / adresse').inputValue(), '2 rue B, Lévis', 'adresse du site reprise');
  await dlg(page).getByRole('button', { name: 'Du … au …' }).click();
  const d0 = iso(addDays(new Date(), 1)), d2 = iso(addDays(new Date(), 3));
  await field(page, 'Du').fill(d0);
  await field(page, 'Au').fill(d2);
  await dlg(page).getByText('3 éléments seront créés').waitFor();
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /3 bons de travail créés/);
  const rows = db.rows('workorders').filter((x) => x.client === 'Piscine Beta' && x.id !== 'wo-other');
  assert.equal(rows.length, 3);
  assert.ok(rows[0].groupe_id && rows.every((r) => r.groupe_id === rows[0].groupe_id));
  assert.deepEqual(rows.map((r) => r.date), [d0, iso(addDays(new Date(), 2)), d2]);
  await page.close();
});

test('créneau : site choisi → site_id et adresse, plusieurs techniciens', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.openFE('plan', null, {}));
  await field(page, 'Client / site').fill('Piscine Alpha');
  await dlg(page).getByRole('button', { name: /Kaël Test/ }).click();
  await dlg(page).getByRole('button', { name: /Autre Tech/ }).click();
  await field(page, 'Heure').fill('13:30');
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Créneau créé/);
  const p = db.rows('plan')[0];
  assert.equal(p.site_id, '1');
  assert.equal(p.addr, '1 rue A, Québec');
  assert.equal(p.emp, 'kael, kael2');
  assert.equal(p.heure, '13:30');
  await page.close();
});

test('tâche planning : récurrence lun/mer sur 2 semaines, copies indépendantes par technicien', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  // lundi prochain → dimanche de la semaine suivante
  const now = new Date(), lun = addDays(now, ((8 - now.getDay()) % 7) || 7);
  await A(page, () => window.__admin.openFE('pt', null, {}));
  await field(page, 'Titre').fill('Relevés RQEP');
  await dlg(page).getByRole('button', { name: 'Récurrence' }).click();
  await field(page, 'Première date').fill(iso(lun));
  await field(page, 'Jusqu’au').fill(iso(addDays(lun, 13)));
  await dlg(page).getByRole('button', { name: 'L', exact: true }).click();
  await dlg(page).getByRole('button', { name: 'M', exact: true }).nth(1).click();
  await dlg(page).getByRole('button', { name: /Kaël Test/ }).click();
  await dlg(page).getByRole('button', { name: /Autre Tech/ }).click();
  await dlg(page).getByRole('button', { name: /Tâche partagée/ }).click();
  await dlg(page).getByText('4 éléments seront créés').waitFor();
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /8 tâches planning créées/);
  const rows = db.rows('planning_tasks');
  assert.equal(rows.length, 8, '4 dates × 2 techniciens');
  assert.deepEqual([...new Set(rows.map((r) => r.emp))].sort(), ['kael', 'kael2']);
  assert.ok(rows.every((r) => r.recurrence && r.recurrence.serie === rows[0].recurrence.serie));
  assert.ok(rows.every((r) => r.date_debut === r.date_fin));
  await page.close();
});

test('tâche planning « du … au … » : UNE tâche qui couvre la période', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.openFE('pt', null, {}));
  await field(page, 'Titre').fill('Fermeture de saison');
  await dlg(page).getByRole('button', { name: 'Du … au …' }).click();
  await field(page, 'Du').fill(today());
  await field(page, 'Au').fill(iso(addDays(new Date(), 4)));
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Tâche planning créé/);
  const r = db.rows('planning_tasks');
  assert.equal(r.length, 1);
  assert.equal(r[0].date_fin, iso(addDays(new Date(), 4)));
  await page.close();
});

test('suppression en deux temps, et impression du bon de travail', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.openFE('wo', 'wo-mine'));
  await dlg(page).getByText('Liste de tâches').waitFor();
  const [pop] = await Promise.all([page.waitForEvent('popup'), dlg(page).getByRole('button', { name: 'Imprimer' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.locator('body').innerText(), /Bon de travail — Piscine Alpha[\s\S]*Signature/);
  await pop.close();
  await dlg(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  assert.ok(db.rows('workorders').some((x) => x.id === 'wo-mine'), 'pas supprimé au premier clic');
  await dlg(page).getByRole('button', { name: 'Confirmer la suppression' }).click();
  await toast(page, /1 supprimé/);
  assert.ok(!db.rows('workorders').some((x) => x.id === 'wo-mine'));
  await page.close();
});

test('champ obligatoire vide : rien n’est envoyé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.openFE('wo', null, {}));
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Le client est requis/);
  assert.equal(db.writes('workorders').length, 0);
  await page.close();
});

test('sa-terrain : un bon de travail « complété » dans SA Platform compte comme fait', async () => {
  const tables = base(); tables.workorders[0].status = 'complete';
  const { page } = await openApp(browser, srv.url, { app: 'terrain', user: { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien' }, tables });
  await page.waitForFunction(() => window.__terrain && window.__terrain.jobs.length === 1);
  assert.equal(await A(page, () => window.__terrain.jobs[0].statut), 'fait');
  await page.close();
});

test('planning : impression de la semaine (techniciens × jours)', async () => {
  const tables = base();
  tables.planning_tasks = [{ id: 'pt1', titre: 'Relevés', emp: 'kael', site_nom: 'Piscine Alpha', date_debut: today(), date_fin: today(), heure_debut: '08:00', statut: 'assigne' }];
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await ready(page);
  await A(page, () => window.__admin.go('planning'));
  await page.waitForFunction(() => !window.__admin.vals().pLoading);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Imprimer la semaine' }).click()]);
  await pop.waitForLoadState();
  const t = await pop.locator('body').innerText();
  assert.match(t, /Planning équipe — Semaine/);
  if (new Date().getDay() >= 1 && new Date().getDay() <= 5) assert.match(t, /08:00 Piscine Alpha\s+Relevés/);
  await pop.close();
  await page.close();
});
