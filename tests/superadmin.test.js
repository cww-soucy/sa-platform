'use strict';
// sa-admin — rôle « superadmin » (créateur) : pouvoirs admin complets, invisibilité dans les
// listes employés / punch, et masque « Superviseur » optionnel dans l'écran Comptes.
// Voir docs/sql/MIGRATION_2026-11-08_superadmin.sql et CLAUDE.md.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

// Ajoute un superadmin « patron » (visibilité au choix) aux fixtures de base.
function avecPatron(visib) {
  const t = base();
  const d = visib ? { sa_visibilite: visib } : {};
  t.comptes.push({ id: 'patron', prenom: 'Le', nom: 'Patron', dept: 'Bureau', email: '', tel: '', role: 'superadmin', droits: d, statut: 'actif', saisonnier: false });
  t.comptes_publics.push({ id: 'patron', prenom: 'Le', nom: 'Patron', role: 'superadmin', dept: 'Bureau', tel: '' });
  return t;
}

async function comptesCharges(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.loadComptes(true));
  await page.waitForFunction(() => Array.isArray(window.__admin.cptes));
}
const vals = (page) => page.evaluate(() => window.__admin.comptesVals());
const equipeIds = (page) => page.evaluate(() => window.__admin.comEquipe().map((c) => c.id));

test('Admin ordinaire : le superadmin est invisible dans les listes employés et masqué en « Superviseur »', async () => {
  const { page, errors } = await openApp(browser, srv.url, {
    app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' }, tables: avecPatron('superviseur') });
  await comptesCharges(page);

  // Jamais dans les listes de travailleurs (plan, punch, paie…).
  assert.ok(!(await equipeIds(page)).includes('patron'), 'le superadmin ne doit pas figurer dans l’équipe');

  // Écran Comptes : présent mais déguisé en « Superviseur » (visibilité = superviseur).
  const r = await vals(page);
  const ligne = r.cRows.find((x) => x.id === 'patron');
  assert.ok(ligne, 'avec visibilité superviseur, la ligne apparaît');
  assert.equal(ligne.role, 'Superviseur', 'rôle affiché masqué');

  // Un admin ordinaire ne peut pas ouvrir la fiche superadmin.
  await page.evaluate(() => window.__admin.openCompte('patron'));
  assert.equal(await page.evaluate(() => window.__admin.state.ce), null, 'ouverture bloquée pour un non-superadmin');

  assert.deepEqual(errors, []);
});

test('Admin ordinaire : en visibilité « fantome », le superadmin disparaît totalement de l’écran Comptes', async () => {
  const { page, errors } = await openApp(browser, srv.url, {
    app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' }, tables: avecPatron('fantome') });
  await comptesCharges(page);
  const r = await vals(page);
  assert.ok(!r.cRows.some((x) => x.id === 'patron'), 'fantome : aucune ligne');
  assert.deepEqual(errors, []);
});

test('Superadmin connecté : pouvoirs admin complets, se voit en « Superadmin », reste hors équipe', async () => {
  const { page, errors } = await openApp(browser, srv.url, {
    app: 'admin', user: { id: 'patron', prenom: 'Le', nom: 'Patron', role: 'superadmin' }, tables: avecPatron('superviseur') });
  await comptesCharges(page);

  const r = await vals(page);
  assert.equal(r.cCanEdit, true, 'le superadmin a les droits d’édition (pouvoirs admin)');
  const ligne = r.cRows.find((x) => x.id === 'patron');
  assert.ok(ligne && ligne.role === 'Superadmin', 'le superadmin se voit sous son vrai rôle');

  // Toujours exclu des listes de travailleurs, même pour lui-même.
  assert.ok(!(await equipeIds(page)).includes('patron'));

  // En-tête discret : affiché comme « Supervision », pas « Administration ».
  const meRole = await page.evaluate(() => window.__admin.vals().meRole);
  assert.equal(meRole, 'Supervision');

  assert.deepEqual(errors, []);
});

// Après refonte « assignation vs rapports » (2026-11-09) : un compte bureau/superadmin qui a
// réellement punché figure dans l'équipe (rapports) ; un compte bureau idle n'y figure pas.
test('Rapports : un superadmin qui a punché figure dans l’équipe ; idle, il en reste exclu', async () => {
  const { weekKey, dayIdx } = require('./harness');
  const t1 = avecPatron('superviseur');            // patron (superadmin) sans punch
  assert.ok(!t1.feuilles_temps.some((f) => f.uid === 'patron'), 'patron n’a pas de feuille');

  const { page: p1 } = await openApp(browser, srv.url, { app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' }, tables: t1 });
  await p1.waitForFunction(() => window.__admin && window.__admin.D);
  assert.ok(!(await p1.evaluate(() => window.__admin.comEquipe().map((c) => c.id))).includes('patron'),
    'idle : exclu des rapports/équipe');
  await p1.close();

  // patron a punché cette semaine → doit apparaître
  const t2 = avecPatron('superviseur');
  const days = Array.from({ length: 7 }, () => ({ status: 'idle', tasks: [], saved: false }));
  days[dayIdx()].tasks.push({ id: 9, lieu: 'Bureau', start: '08:00', end: '09:00', hrs: 1, active: false });
  t2.feuilles_temps.push({ id: 'patron_' + weekKey(), uid: 'patron', emp: 'Le Patron', week: weekKey(), days, total_h: 1, updated_at: '2026-01-01T00:00:00Z' });

  const { page: p2 } = await openApp(browser, srv.url, { app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' }, tables: t2 });
  await p2.waitForFunction(() => window.__admin && window.__admin.D);
  assert.ok((await p2.evaluate(() => window.__admin.comEquipe().map((c) => c.id))).includes('patron'),
    'a punché : figure dans l’équipe');
  await p2.close();
});
