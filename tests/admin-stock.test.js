'use strict';
// sa-admin — Stock (inventaire) et Flotte (tables et champs de SA Platform).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
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

function tables() {
  const t = base();
  t.inventaire[0].seuil = 15; t.inventaire[0].prix = 42.5;
  t.inventaire[0].updated_at = '2026-01-01T00:00:00Z';
  return t;
}

test('stock : alerte sous le seuil, filtre, nouveau produit', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('stock'));
  await page.getByText(/1 produit\(s\) sous le seuil d’alerte : Chlore liquide 20 L/).waitFor();
  await page.getByRole('button', { name: 'Sous le seuil (1)' }).click();
  await page.waitForFunction(() => window.__admin.vals().iRows.length === 1);
  await page.getByRole('button', { name: 'Nouveau produit' }).click();
  await field(page, 'Nom du produit').fill('Algicide');
  await field(page, 'Unité').selectOption('L');
  await field(page, 'Qté en stock').fill('6');
  await field(page, 'Seuil d’alerte').fill('2');
  await field(page, 'Prix unitaire ($)').fill('19.99');
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Produit enregistré/);
  const r = db.rows('inventaire').find((x) => x.nom === 'Algicide');
  assert.equal(r.unite, 'L');
  assert.equal(r.qte, 6);
  assert.equal(r.seuil, 2);
  assert.equal(r.prix, 19.99);
  assert.equal(r.categorie, 'chimique');
  assert.deepEqual(errors, []);
  await page.close();
});

test('stock : entrée / sortie relit la quantité du serveur (pas d’écrasement)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('stock'));
  await page.getByRole('row', { name: /Chlore liquide/ }).getByRole('button', { name: 'Ouvrir' }).click();
  // quelqu'un d'autre sort 2 bidons pendant que la fiche est ouverte
  db.rows('inventaire').find((x) => x.id === 'i1').qte = 10;
  await dlg(page).getByLabel('Quantité à ajuster').fill('5');
  await dlg(page).getByRole('button', { name: '+ Entrée' }).click();
  await toast(page, /Entrée enregistrée — stock : 15/);
  assert.equal(db.rows('inventaire').find((x) => x.id === 'i1').qte, 15);
  await dlg(page).getByLabel('Quantité à ajuster').fill('20');
  await dlg(page).getByRole('button', { name: '− Sortie' }).click();
  await toast(page, /stock insuffisant/);
  assert.equal(db.rows('inventaire').find((x) => x.id === 'i1').qte, 15);
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'inventaire'));
  await page.close();
});

test('stock : export Excel lisible', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('stock'));
  await page.getByRole('row', { name: /Chlore liquide/ }).waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()]);
  assert.match(dl.suggestedFilename(), /^SoucyAquatik_Stock_.*\.xlsx$/);
  const buf = require('fs').readFileSync(await dl.path());
  assert.equal(buf.slice(0, 2).toString(), 'PK');
  await page.close();
});

test('flotte : modifier un véhicule (assignation, plaque en majuscules) et suppression en deux temps', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('flotte'));
  await page.getByRole('row', { name: /Dodge Promaster/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await field(page, 'Plaque').fill('xyz 789');
  await field(page, 'Kilométrage').fill('84200');
  await field(page, 'Assigné à').selectOption('kael');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Véhicule enregistré/);
  const v = db.rows('flotte').find((x) => x.id === 'v1');
  assert.equal(v.plaque, 'XYZ 789');
  assert.equal(v.km, '84200');
  assert.equal(v.assigne, 'kael');
  await page.getByRole('row', { name: /Kaël Test/ }).waitFor();
  assert.equal(await A(page, () => window.__admin.D.flotte[0].plaque), 'XYZ 789', 'liste des véhicules du Plan de Match à jour');
  await page.getByRole('row', { name: /Dodge Promaster/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await dlg(page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  assert.ok(db.rows('flotte').length === 1);
  await dlg(page).getByRole('button', { name: 'Confirmer la suppression' }).click();
  await toast(page, /Supprimé/);
  assert.equal(db.rows('flotte').length, 0);
  await page.close();
});
