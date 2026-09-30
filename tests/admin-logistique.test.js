'use strict';
// sa-admin — Logistique (bons de livraison, sorties d'inventaire) et Hivernage côté bureau (tables SA Platform).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today } = require('./harness');
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

test('logistique : liste des bons, filtre, ouvrir et marquer livré', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.go('logistique'));
  await page.getByText('SA-20260928-111').waitFor();
  await page.getByText('SA-20260901-222').waitFor();
  await page.getByRole('button', { name: 'À livrer', exact: true }).click();
  await page.waitForFunction(() => window.__admin.vals().docRows.length === 1);
  await page.getByRole('row', { name: /SA-20260928-111/ }).getByRole('button', { name: 'Ouvrir' }).click();
  assert.equal(await field(page, 'Client').inputValue(), 'Piscine Beta');
  await dlg(page).getByRole('button', { name: 'Marquer livré' }).click();
  await toast(page, /Bon marqué livré/);
  const b = db.rows('bons_livraison').find((x) => x.id === 'bl-a');
  assert.equal(b.status, 'livre');
  assert.equal(b.livre_by, 'cwweil');
  assert.equal(b.livre_par_nom, 'Bureau SA');
  assert.ok(b.livre_at);
  assert.deepEqual(b.items_liv.map((i) => i.item), ['Chlore liquide 20 L'], 'articles conservés');
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'bons_livraison'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('logistique : nouveau bon de livraison (adresse du site reprise, lignes vides ignorées)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.go('logistique'));
  await page.getByRole('button', { name: /Nouveau bon de livraison/ }).click();
  await field(page, 'Client').fill('Piscine Alpha');
  assert.equal(await field(page, 'Adresse de livraison').inputValue(), '1 rue A, Québec');
  await dlg(page).getByLabel('Article', { exact: true }).first().fill('Pompe 1 HP');
  await dlg(page).getByLabel('Qté sortie').first().fill('1');
  await dlg(page).getByRole('button', { name: '+ Ajouter un article', exact: true }).click();
  await field(page, 'Technicien / livreur').selectOption('Kaël Test');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Bon de livraison enregistré/);
  const b = db.rows('bons_livraison').find((x) => x.client === 'Piscine Alpha');
  assert.ok(b && /^SA-\d{8}-\d{3}$/.test(b.no_bon));
  assert.equal(b.technicien, 'Kaël Test');
  assert.deepEqual(b.items_liv, [{ item: 'Pompe 1 HP', qteSortie: '1', unite: '', qteLivree: '', statut: '' }]);
  assert.equal(b.status, 'brouillon');
  assert.equal(b.created_by, 'cwweil');
  await page.close();
});

test('logistique : sortie d’inventaire créée par le bureau puis envoyée', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.go('logistique'));
  await page.getByRole('button', { name: 'Sorties d’inventaire' }).click();
  await page.getByRole('button', { name: /Nouvelle sortie/ }).click();
  await field(page, 'Employé').selectOption('Kaël Test');
  assert.equal(await field(page, 'N° employé').inputValue(), 'kael');
  await dlg(page).getByLabel('Description').first().fill('Filtre à cartouche');
  await dlg(page).getByRole('button', { name: 'Envoyer au superviseur' }).click();
  await toast(page, /Sortie envoyée/);
  const s = db.rows('sorties_inventaire')[0];
  assert.equal(s.status, 'envoye');
  assert.ok(s.sent_at);
  assert.equal(s.nom, 'Kaël Test');
  assert.equal(s.no_employe, 'kael');
  assert.equal(s.lignes.length, 1);
  await page.close();
});

test('hivernage : compléter un rapport existant (constats, priorité, plan, suivi) et imprimer', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.go('hivernage'));
  await page.getByRole('row', { name: /Piscine Beta/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await dlg(page).getByRole('button', { name: '+ Ajouter une section' }).click();
  await dlg(page).getByLabel('Titre de la section').last().fill('Drain principal');
  await dlg(page).getByLabel('Priorité de la section').last().selectOption('urgent');
  await dlg(page).getByRole('button', { name: '+ Ajouter un constat' }).last().click();
  await dlg(page).getByLabel('Constat').last().fill('Grille fissurée');
  await dlg(page).getByRole('button', { name: '+ Ajouter une ligne' }).click();
  await dlg(page).getByLabel('Élément', { exact: true }).fill('Drain');
  await dlg(page).getByLabel('Travaux prévus').fill('Remplacer la grille');
  await dlg(page).getByRole('button', { name: '+ Ajouter un suivi' }).click();
  await dlg(page).getByLabel('Élément suivi').fill('Grille');
  await dlg(page).getByRole('button', { name: 'Devis demandé' }).click();
  await field(page, 'Recommandation générale').fill('Prévoir les travaux avant mai.');
  const [pop] = await Promise.all([page.waitForEvent('popup'), dlg(page).getByRole('button', { name: 'Imprimer' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.locator('body').innerText(), /Piscine Beta[\s\S]*Drain principal[\s\S]*Grille fissurée[\s\S]*Prévoir les travaux avant mai/);
  await pop.close();
  await dlg(page).getByRole('button', { name: 'Marquer complété' }).click();
  await toast(page, /Rapport complété/);
  const r = db.rows('rapports_hivernage').find((x) => x.id === 'hv-old');
  assert.equal(r.status, 'complete');
  assert.equal(r.site_id, '2');
  const sec = r.sections.find((s) => s.title === 'Drain principal');
  assert.equal(sec.tag, 'urgent');
  assert.deepEqual(sec.items, ['Grille fissurée']);
  assert.equal(r.plan[0].travaux, 'Remplacer la grille');
  assert.equal(r.suivi[0].c1, true);
  assert.equal(r.callout, 'Prévoir les travaux avant mai.');
  assert.deepEqual(errors, []);
  await page.close();
});

test('hivernage : nouveau rapport (site requis), puis suppression en deux temps', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await ready(page);
  await A(page, () => window.__admin.go('hivernage'));
  await page.getByRole('button', { name: /Nouveau rapport/ }).click();
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Le site est requis/);
  assert.equal(db.writes('rapports_hivernage').length, 0);
  await field(page, 'Site').fill('Piscine Alpha');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Rapport d’hivernage enregistré/);
  const r = db.rows('rapports_hivernage').find((x) => x.site_nom === 'Piscine Alpha');
  assert.equal(r.site_id, '1');
  assert.equal(r.sections.length, 5, 'sections standard de SA Platform');
  assert.equal(r.date_inspection, today());
  await page.getByRole('row', { name: /Piscine Alpha/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await dlg(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  assert.ok(db.rows('rapports_hivernage').some((x) => x.id === r.id));
  await dlg(page).getByRole('button', { name: 'Confirmer la suppression' }).click();
  await toast(page, /Supprimé/);
  assert.ok(!db.rows('rapports_hivernage').some((x) => x.id === r.id));
  await page.close();
});
