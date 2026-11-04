'use strict';
// Affichage configurable des apps (sa-admin › Affichage des apps) : règles par profil, appliquées à sa-admin et sa-terrain.
// Catalogue et calcul : src/affichage/affichage.js ; table affichage_regles (MIGRATION_2026-11-03_affichage_modules.sql).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');
const A = require('../src/affichage/affichage.js');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const SUP = { id: 'chef', prenom: 'Chef', nom: 'Équipe', role: 'superviseur' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
const R = (app, cible, masques) => ({ id: app + '|' + cible, app, cible, masques });
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const ready = (page) => page.waitForFunction(() => window.__admin && window.__admin.D);
const menu = (page) => page.locator('nav').first().innerText();
const cache = (page, sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).display === 'none');

test('calcul : tout visible par défaut ; le profil le plus précis l’emporte ; parent ; verrous', () => {
  assert.equal(A.nbMasques(A.resoudre([], 'admin', { role: 'superviseur', compte: 'chef' })), 0, 'sans règle, rien n’est masqué');
  const regles = [R('admin', 'tous', { 'menu.stats': true, 'menu.planning': true, 'menu.affichage': true }), R('admin', 'role:superviseur', { 'menu.stats': false, 'menu.flotte': true }),
    R('admin', 'compte:chef', { 'menu.flotte': false }), R('terrain', 'tous', { 'onglet.planning': true })];
  const chef = A.resoudre(regles, 'admin', { role: 'superviseur', compte: 'Chef' });
  assert.equal(A.visible(chef, 'menu.stats'), true, 'le rôle réaffiche ce que « tout le monde » masque');
  assert.equal(A.visible(chef, 'menu.flotte'), true, 'l’employé réaffiche ce que son rôle masque');
  assert.equal(A.visible(chef, 'menu.planning'), false);
  assert.equal(A.visible(chef, 'planning.gantt'), false, 'les vues de Planning suivent le module');
  assert.equal(A.visible(chef, 'menu.affichage'), false);
  assert.equal(chef.source['menu.flotte'], 'compte:chef');
  const autre = A.resoudre(regles, 'admin', { role: 'superviseur', compte: 'x' });
  assert.equal(A.visible(autre, 'menu.flotte'), false);
  const adm = A.resoudre(regles, 'admin', { role: 'admin', compte: 'cwweil' });
  assert.equal(A.visible(adm, 'menu.affichage'), true, 'un administrateur garde toujours l’écran de configuration');
  assert.deepEqual(A.cibles('admin', { role: 'technicien', compte: 'kael' }), ['tous', 'role:employe', 'compte:kael'], 'un rôle inconnu compte comme employé');
  const t = A.resoudre(regles.concat([R('terrain', 'tous', { 'onglet.profil': true, 'onglet.planning': true })]), 'terrain', { role: 'employe' });
  assert.equal(A.visible(t, 'onglet.profil'), true, 'Profil (déconnexion) ne peut pas être masqué');
  assert.equal(A.visible(t, 'planning.recurrentes'), false);
  assert.equal(A.css({ masque: { 'mon.flux': true, 'x"]{}': true } }), '[data-aff~="mon.flux"]{display:none!important}', 'clés non sûres ignorées dans la règle CSS');
  // portail : tous → niveau
  const p = A.resoudre([R('portail', 'tous', { 'onglet.factures': true }), R('portail', 'niveau:direction', { 'onglet.factures': false })], 'portail', { niveau: 'direction' });
  assert.equal(A.visible(p, 'onglet.factures'), true);
  // chaque parent du catalogue existe
  Object.keys(A.ITEMS).forEach((app) => Object.values(A.ITEMS[app]).forEach((it) => { if (it.parent) assert.ok(A.ITEMS[app][it.parent], app + ' : parent inconnu ' + it.parent); }));
});

test('sa-admin : un superviseur ne voit plus les modules, onglets et sections masqués ; un lien direct est redirigé', async () => {
  const t = base();
  t.comptes.push({ id: 'chef', prenom: 'Chef', nom: 'Équipe', dept: 'Bureau', email: '', tel: '', role: 'superviseur', droits: {}, statut: 'actif', saisonnier: false });
  t.affichage_regles = [R('admin', 'role:superviseur', { 'menu.facturation': true, 'menu.stats': true, 'mon.flux': true, 'temps.paie': true, 'sites.rep': true }),
    R('admin', 'tous', { 'menu.flotte': true })];
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: SUP, tables: t });
  await ready(page);
  const m = await menu(page);
  assert.doesNotMatch(m, /Facturation|Stats|Flotte/);
  assert.match(m, /Monitoring[\s\S]*Temps · Paie/);
  assert.ok(await cache(page, '[data-aff~="mon.flux"]'), 'section Flux terrain masquée');
  assert.equal(await cache(page, '[data-aff~="mon.equipe"]'), false, 'les autres sections restent');
  await page.evaluate(() => window.__admin.go('facturation'));
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'monitoring', 'module masqué → premier module visible');
  await page.evaluate(() => window.__admin.go('temps', { tempsTab: 'paie' }));
  assert.notEqual(await page.evaluate(() => window.__admin.state.tempsTab), 'paie');
  assert.doesNotMatch(await page.locator('main').innerText(), /\bPaie\b(?! ·)/, 'onglet Paie absent');
  await page.evaluate(() => window.__admin.go('sites', { sitesTab: 'clients' }));
  assert.doesNotMatch(await page.getByRole('tablist', { name: 'Sites et inspections' }).innerText(), /Répertoire/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : l’administrateur masque un module pour les superviseurs, enregistre, et voit l’aperçu', async () => {
  const t = base();
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await ready(page);
  await page.evaluate(() => window.__admin.go('affichage'));
  await page.getByRole('tab', { name: /sa-admin/ }).waitFor();
  // le profil « Administrateurs » ne peut pas se retirer l'écran de configuration
  await page.getByRole('button', { name: 'Administrateurs' }).click();
  await page.locator('[data-cle="menu.affichage"]').getByText('Toujours visible pour un administrateur').waitFor();
  await page.getByRole('button', { name: 'Superviseurs' }).click();
  const stats = page.locator('[data-cle="menu.stats"]');
  await stats.getByRole('button', { name: 'Masquer' }).click();
  await page.locator('[data-cle="menu.temps"]').getByRole('button', { name: 'Masquer' }).click();
  assert.match(await page.locator('[data-cle="temps.paie"]').innerText(), /Masqué — masqué avec « Temps · Paie »/);
  assert.match(await page.locator('main').innerText(), /changements non enregistrés/);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.waitForFunction(() => /Affichage enregistré/.test(window.__admin.state.toast || ''));
  const row = db.rows('affichage_regles').find((r) => r.id === 'admin|role:superviseur');
  assert.deepEqual(row && row.masques, { 'menu.stats': true, 'menu.temps': true });
  assert.equal(row.app, 'admin'); assert.equal(row.cible, 'role:superviseur'); assert.equal(row.updated_by, 'cwweil');
  assert.match(await menu(page), /Stats/, 'l’administrateur lui-même n’est pas touché');
  // aperçu
  await page.getByRole('button', { name: 'Voir sa-admin comme ce profil' }).click();
  await page.getByRole('status').getByText('Aperçu : sa-admin tel que le voit « Superviseurs »').waitFor();
  assert.doesNotMatch(await menu(page), /Stats|Temps · Paie/);
  assert.match(await menu(page), /Affichage des apps/, 'le chemin du retour reste');
  await page.getByRole('button', { name: 'Quitter l’aperçu' }).click();
  assert.match(await menu(page), /Stats/);
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'affichage');
  // terrain et portail : leurs propres profils
  await page.getByRole('tab', { name: /sa-terrain/ }).click();
  await page.locator('[data-cle="onglet.profil"]').getByText('Toujours visible').first().waitFor();
  await page.getByRole('tab', { name: /Portail client/ }).click();
  await page.getByRole('button', { name: 'Gestionnaires' }).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : table pas encore créée → tout visible et message clair', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base(), fail: { affichage_regles: 404 } });
  await ready(page);
  assert.match(await menu(page), /Facturation[\s\S]*Stats[\s\S]*Affichage des apps/);
  await page.evaluate(() => window.__admin.go('affichage'));
  await page.getByRole('alert').getByText('Base pas encore prête.').waitFor();
  assert.deepEqual(errors.filter((e) => !/404/.test(e)), []);
  await page.close();
});

test('sa-terrain : onglets, tuiles et sections masqués pour les techniciens ; gardé hors réseau', async () => {
  const t = base();
  t.affichage_regles = [R('terrain', 'role:employe', { 'onglet.planning': true, 'accueil.hivernage': true, 'onglet.profil': true }), R('admin', 'tous', { 'menu.stats': true })];
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt && window.__terrain.affRegles && window.__terrain.affRegles.length);
  await page.waitForTimeout(100);
  const barre = await page.evaluate(() => window.__terrain.vals().tabs.map((x) => x.label));
  assert.deepEqual(barre, ['Aujourd’hui', 'Temps', 'Fiche', 'Demandes', 'Profil'], 'Planning retiré, Profil toujours là');
  assert.ok(await cache(page, '[data-aff~="accueil.hivernage"]'));
  assert.equal(await cache(page, '[data-aff~="accueil.logistique"]'), false);
  await page.evaluate(() => window.__terrain.go('planning'));
  assert.equal(await page.evaluate(() => window.__terrain.state.screen), 'today', 'écran masqué → Aujourd’hui');
  assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('sa_terrain_affichage'))).length, 'règles gardées sur le téléphone');
  assert.deepEqual(errors, []);
  await page.close();
});
