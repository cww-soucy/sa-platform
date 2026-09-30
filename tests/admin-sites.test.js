'use strict';
// sa-admin — Sites : répertoire utile et fiche complète (coordonnées, bassins avec leurs paramètres de relevé, équipements, pièces, journal).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).locator('input,select,textarea').first();

function tables() {
  const t = base();
  t.sites[0].updated_at = '2026-01-01T00:00:00Z';
  t.sites[0].equips = ['Pompe 2 HP'];
  t.site_journal = [{ id: 'j1', site_id: '1', uid: 'kael', emp: 'Kaël Test', date: today(), heure: '09:00', lieu: 'Piscine Alpha', notes: 'Skimmer fissuré', photos: [{ data: 'data:image/png;base64,iVBORw0KGgo=' }] }];
  return t;
}

test('sites : fiche complète — coordonnées, bassins (paramètres de relevé), équipements, journal', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites'));
  await page.getByPlaceholder('Rechercher un site…').fill('alpha');
  await page.getByRole('row', { name: /Piscine Alpha.*C-001/ }).click();
  await dlg(page).getByText('Skimmer fissuré').waitFor();
  await field(page, 'Téléphone').fill('418-555-0199');
  await dlg(page).getByRole('button', { name: '+ Ajouter un bassin' }).click();
  await dlg(page).getByRole('button', { name: '+ Ajouter un bassin' }).click();
  await dlg(page).getByLabel('Nom du bassin').nth(1).fill('Pataugeoire');
  await dlg(page).getByLabel('Type de bassin').nth(1).selectOption('pataugeoire');
  await dlg(page).getByLabel('Paramètres de relevé').nth(1).selectOption('GEN');
  await dlg(page).getByLabel('Nouvel équipement').fill('Chlorinateur');
  await dlg(page).getByRole('button', { name: 'Ajouter', exact: true }).click();
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Fiche du site enregistrée/);
  const s = db.rows('sites').find((x) => String(x.id) === '1');
  assert.equal(s.tel, '418-555-0199');
  assert.deepEqual(s.bassins.map((b) => [b.nom, b.type, b.type_code]), [['Bassin principal', 'piscine', ''], ['Pataugeoire', 'pataugeoire', 'GEN']]);
  assert.deepEqual(s.equips, ['Pompe 2 HP', 'Chlorinateur']);
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'sites'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('sites : modification faite ailleurs pendant l’édition → refusée, rien d’écrasé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.openSiteFiche('1'));
  await field(page, 'Téléphone').waitFor();
  db.rows('sites').find((x) => String(x.id) === '1').updated_at = '2026-09-30T10:00:00Z';
  await field(page, 'Téléphone').fill('999');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /modifiée ailleurs/);
  assert.notEqual(db.rows('sites').find((x) => String(x.id) === '1').tel, '999');
  await page.close();
});

test('sites : nouveau site (nom unique) avec contrat et GPS', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites'));
  await page.getByRole('button', { name: 'Nouveau site' }).click();
  await field(page, 'Nom du site').fill('Piscine Beta');
  await dlg(page).getByRole('button', { name: 'Créer le site' }).click();
  await toast(page, /Un site porte déjà ce nom/);
  await field(page, 'Nom du site').fill('Club Gamma');
  await field(page, 'Latitude').fill('46,85');
  await field(page, 'Longitude').fill('-71.3');
  await field(page, 'N° de contrat').fill('C-009');
  await dlg(page).getByRole('button', { name: 'Créer le site' }).click();
  await toast(page, /Site créé/);
  const s = db.rows('sites').find((x) => x.nom === 'Club Gamma');
  assert.deepEqual(s.gps, { lat: 46.85, lng: -71.3 });
  assert.equal(db.rows('contrats').find((c) => c.site_id === s.id).code, 'C-009');
  await page.close();
});
