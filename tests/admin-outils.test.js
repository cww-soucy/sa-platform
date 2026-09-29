'use strict';
// sa-admin — Outils (QR), Emplacements et configuration logistique (tables de SA Platform v61+).
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
  t.outils = [
    { id: 't1', reperage: 'PER-0001', nom: 'Perceuse DeWalt', categorie_id: 'outil', qr_payload: 'SOUCY-DPTM:PER-0001|Perceuse DeWalt', status: 'sorti', current_holder: 'kael', current_holder_name: 'Kaël Test', emplacement: 'EMP-B3', notes: '' },
    { id: 't2', reperage: 'MES-0001', nom: 'Trousse de test', categorie_id: 'mesure', qr_payload: 'SOUCY-DPTM:MES-0001|Trousse de test', status: 'disponible', current_holder: '', emplacement: 'EMP-B3' },
  ];
  t.outils_mouvements = [{ id: 'm1', tool_id: 't1', tool_reperage: 'PER-0001', tool_nom: 'Perceuse DeWalt', uid: 'kael', emp_nom: 'Kaël Test', action: 'sortie', punch_date: '2026-09-28', heure: '08:10', site_nom: 'Piscine Alpha', created_at: '2026-09-28T12:10:00Z' }];
  t.logistique_config = [{ id: 'prefixes', value: [{ id: 'PER', label: 'Perceuses / visseuses', next: 2, scope: 'outils' }, { id: 'MES', label: 'Instruments de mesure', next: 2, scope: 'outils' }, { id: 'CHI', label: 'Produits chimiques', next: 1, scope: 'inventaire' }] }];
  return t;
}

test('outils : liste, filtre « sortis », historique et retour forcé (journalisé)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('outils'));
  await page.getByRole('row', { name: /Trousse de test/ }).waitFor();
  await page.getByRole('button', { name: 'Sortis (1)' }).click();
  await page.waitForFunction(() => window.__admin.vals().oRows.length === 1);
  await page.getByRole('row', { name: /Perceuse DeWalt.*Sorti — Kaël Test/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await dlg(page).getByText('Sortie — Kaël Test').waitFor();
  assert.equal(await dlg(page).getByRole('button', { name: 'Mettre en maintenance' }).count(), 0, 'pas de maintenance sur un outil sorti');
  await dlg(page).getByRole('button', { name: 'Forcer le retour' }).click();
  await toast(page, /Retour forcé enregistré/);
  const t = db.rows('outils').find((x) => x.id === 't1');
  assert.equal(t.status, 'disponible');
  assert.equal(t.current_holder, '');
  const mv = db.rows('outils_mouvements').find((m) => m.id !== 'm1');
  assert.equal(mv.action, 'retour');
  assert.match(mv.notes, /Retour forcé par Bureau SA \(détenu par Kaël Test\)/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('outils : un outil pris sur le terrain entre-temps n’est pas écrasé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('outils'));
  await page.getByRole('row', { name: /Trousse de test/ }).getByRole('button', { name: 'Ouvrir' }).click();
  Object.assign(db.rows('outils').find((x) => x.id === 't2'), { status: 'sorti', current_holder: 'kael2' });
  await dlg(page).getByRole('button', { name: 'Mettre en maintenance' }).click();
  await toast(page, /vient de changer d’état/);
  assert.equal(db.rows('outils').find((x) => x.id === 't2').status, 'sorti');
  await page.close();
});

test('outils : nouvel outil (numéro suivant du préfixe, emplacement, code QR) + compteur avancé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('outils'));
  await page.getByRole('button', { name: 'Nouvel outil' }).click();
  await field(page, 'Préfixe').selectOption('PER');
  assert.equal(await field(page, 'Numéro').inputValue(), '0002');
  assert.equal(await field(page, 'Préfixe').locator('option[value="CHI"]').count(), 0, 'préfixes d’inventaire exclus');
  await field(page, 'Nom de l’outil').fill('Visseuse Makita');
  await field(page, 'Emplacement').selectOption('EMP-B4');
  await dlg(page).getByText('SOUCY-DPTM:PER-0002|Visseuse Makita').waitFor();
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Outil enregistré/);
  const t = db.rows('outils').find((x) => x.nom === 'Visseuse Makita');
  assert.equal(t.reperage, 'PER-0002');
  assert.equal(t.qr_payload, 'SOUCY-DPTM:PER-0002|Visseuse Makita');
  assert.equal(t.status, 'disponible');
  assert.equal(t.emplacement, 'EMP-B4');
  const pre = db.rows('logistique_config').find((x) => x.id === 'prefixes').value.find((p) => p.id === 'PER');
  assert.equal(pre.next, 3);
  // doublon de repérage refusé
  await page.getByRole('button', { name: 'Nouvel outil' }).click();
  await field(page, 'Préfixe').selectOption('MES');
  await field(page, 'Numéro').fill('0001');
  await field(page, 'Nom de l’outil').fill('Doublon');
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Ce repérage existe déjà/);
  assert.ok(!db.rows('outils').some((x) => x.nom === 'Doublon'));
  await page.close();
});

test('outils : étiquette QR imprimable (image QR réelle)', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('outils'));
  await page.getByRole('row', { name: /Trousse de test/ }).getByRole('button', { name: 'Ouvrir' }).click();
  const [pop] = await Promise.all([page.waitForEvent('popup'), dlg(page).getByRole('button', { name: 'Imprimer l’étiquette' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.locator('body').innerText(), /MES-0001/);
  const src = await pop.locator('img').first().getAttribute('src');
  assert.match(src, /^data:image\/png;base64,.{200}/);
  await pop.close();
  await page.close();
});

test('emplacements : groupés par bâtiment, ajout (config relue au serveur), suppression refusée si occupé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('outils'));
  await page.getByRole('button', { name: 'Emplacements' }).click();
  await page.getByRole('row', { name: /Étagère 3.*2 outil\(s\) · 1 sorti\(s\)/ }).waitFor();
  await page.getByRole('button', { name: 'Nouvel emplacement' }).click();
  await field(page, 'Code de repérage').fill('emp-c1');
  await field(page, 'Zone').fill('Zone C — Pompes');
  await field(page, 'Étagère / local').fill('Étagère 5');
  // quelqu'un a modifié la config ailleurs pendant ce temps : elle ne doit pas être perdue
  db.rows('logistique_config').push({ id: 'emplacements', value: [{ id: 'EMP-X', bat: 'Bureau', zone: 'Accueil', nom: 'Tiroir' }] });
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Enregistré/);
  const v = db.rows('logistique_config').find((x) => x.id === 'emplacements').value;
  assert.deepEqual(v.map((e) => e.id), ['EMP-X', 'EMP-C1']);
  await page.getByRole('row', { name: /Tiroir/ }).waitFor();
  await page.close();
  // suppression d'un emplacement qui contient des outils : refusée
  const t2 = tables();
  const r2 = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t2 });
  await ready(r2.page);
  await A(r2.page, () => { window.__admin.go('outils'); window.__admin.setState({ outTab: 'emp' }); });
  await r2.page.getByRole('row', { name: /Étagère 3/ }).getByRole('button', { name: 'Modifier' }).click();
  await dlg(r2.page).getByRole('button', { name: 'Supprimer', exact: true }).click();
  await toast(r2.page, /2 outil\(s\) rangé\(s\) ici/);
  assert.equal(r2.db.writes('logistique_config').length, 0);
  await r2.page.close();
});

test('configuration : catégorie ajoutée, préfixe QR modifié', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await ready(page);
  await A(page, () => window.__admin.go('outils'));
  await page.getByRole('button', { name: 'Configuration' }).click();
  await page.getByRole('button', { name: '+ Ajouter' }).first().click();
  await field(page, 'Icône (emoji)').fill('🧰');
  await field(page, 'Nom de la catégorie').fill('Électrique');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Enregistré/);
  const cats = db.rows('logistique_config').find((x) => x.id === 'categories').value;
  assert.deepEqual(cats[cats.length - 1], { id: 'electrique', icon: '🧰', label: 'Électrique' });
  assert.equal(cats.length, 6, 'catégories par défaut conservées');
  await page.getByLabel('Préfixe QR').fill('SA-QR:');
  await page.getByRole('button', { name: 'Enregistrer le préfixe' }).click();
  await toast(page, /Préfixe QR enregistré/);
  assert.equal(db.rows('logistique_config').find((x) => x.id === 'qr_prefix').value, 'SA-QR:');
  await page.close();
});
