'use strict';
// sa-admin — Comptes (table comptes partagée) et mot de passe défini via la fonction serveur admin_definir_mdp.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const A = (page, fn, arg) => page.evaluate(fn, arg);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label + '$') }) }).locator('input,select').first();
// simulation serveur : le mot de passe de l'administrateur est « Admin-12345 »
const mdp = (db) => { db.defs = []; db.rpc.admin_definir_mdp = (b) => { if (b.p_admin_mdp !== 'Admin-12345') return false; if (b.p_nouveau.length < 8) throw new Error('8 caractères'); db.defs.push(b); return true; }; };
async function comptes(page) { await page.waitForFunction(() => window.__admin && window.__admin.D); await A(page, () => window.__admin.go('comptes')); await page.getByRole('cell', { name: 'kael2' }).waitFor(); }

test('liste des comptes et création d’un employé avec mot de passe initial', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  mdp(db);
  await comptes(page);
  assert.match(await page.locator('main').innerText(), /Autre Tech\s+kael2\s+Employé|Autre Tech[\s\S]*saisonnier/);
  await page.getByRole('button', { name: 'Nouveau compte' }).click();
  await field(page, 'Prénom').fill('Julie');
  await field(page, 'Nom').fill('Côté');
  await field(page, 'Identifiant de connexion').fill('JCote');
  await field(page, 'Mot de passe \\(8 caractères min\\.\\)').fill('Depart-2026');
  await field(page, 'Confirmer').fill('Depart-2026');
  await field(page, 'Votre mot de passe administrateur \\(confirmation\\)').fill('Admin-12345');
  await dlg(page).getByRole('button', { name: 'Créer le compte' }).click();
  await toast(page, /Compte créé/);
  const c = db.rows('comptes').find((x) => x.id === 'jcote');
  assert.ok(c, 'identifiant mis en minuscules');
  assert.equal(c.role, 'employe');
  assert.equal(c.statut, 'actif');
  assert.equal(c.mdp, undefined, 'jamais de mot de passe dans la table');
  assert.deepEqual(db.defs.map((d) => [d.p_admin_id, d.p_cible_id, d.p_nouveau]), [['cwweil', 'jcote', 'Depart-2026']]);
  assert.deepEqual(errors, []);
  await page.close();
});

test('mauvais mot de passe administrateur : compte gardé, mot de passe non défini, message clair', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  mdp(db);
  await comptes(page);
  await page.getByRole('row', { name: /kael2/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await field(page, 'Mot de passe \\(8 caractères min\\.\\)').fill('Nouveau-999');
  await field(page, 'Confirmer').fill('Nouveau-999');
  await field(page, 'Votre mot de passe administrateur \\(confirmation\\)').fill('faux');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /mot de passe NON défini/);
  assert.equal(db.defs.length, 0);
  await page.close();
});

test('modifier rôle, droits, statut (désactiver) ; validations', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  mdp(db);
  await comptes(page);
  await page.getByRole('row', { name: /kael2/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await field(page, 'Mot de passe \\(8 caractères min\\.\\)').fill('abc');
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /ne correspondent pas|8 caractères/);
  await field(page, 'Mot de passe \\(8 caractères min\\.\\)').fill('');
  await field(page, 'Rôle').selectOption('superviseur');
  await field(page, 'Statut').selectOption('inactif');
  await dlg(page).getByRole('button', { name: /Statistiques/ }).click();
  await dlg(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Compte enregistré/);
  const c = db.rows('comptes').find((x) => x.id === 'kael2');
  assert.equal(c.role, 'superviseur');
  assert.equal(c.statut, 'inactif');
  assert.equal(c.droits.stats, true);
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'comptes' && a.ressource_id === 'kael2'));
  await page.close();
});

test('suppression en deux temps ; son propre compte ne peut pas être supprimé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await comptes(page);
  await page.getByRole('row', { name: /cwweil/ }).getByRole('button', { name: 'Ouvrir' }).click();
  assert.equal(await dlg(page).getByRole('button', { name: /Supprimer/ }).count(), 0);
  await dlg(page).getByRole('button', { name: 'Fermer' }).first().click();
  await page.getByRole('row', { name: /kael2/ }).getByRole('button', { name: 'Ouvrir' }).click();
  await dlg(page).getByRole('button', { name: 'Supprimer le compte' }).click();
  assert.ok(db.rows('comptes').some((x) => x.id === 'kael2'));
  await dlg(page).getByRole('button', { name: 'Confirmer la suppression' }).click();
  await toast(page, /Compte supprimé/);
  assert.ok(!db.rows('comptes').some((x) => x.id === 'kael2'));
  await page.close();
});

test('superviseur : lecture seule', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: { id: 'sup', prenom: 'S', nom: 'P', role: 'superviseur' }, tables: base() });
  await comptes(page);
  await page.getByText('Lecture seule : seul un administrateur').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Nouveau compte' }).count(), 0);
  await page.close();
});

test('sauvegarde complète : fichier JSON sans aucun mot de passe', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await comptes(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sauvegarde complète (.json)' }).click()]);
  const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert.equal(j.workorders.length, 2);
  assert.equal(j.comptes.length, 3);
  assert.ok(!/mdp/.test(JSON.stringify(j.comptes)));
  await page.close();
});

test('comptes : lien calendrier Outlook / Gmail — créer, copier, révoquer (même table que SA Platform)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => { window.__admin.go('comptes'); });
  await page.waitForFunction(() => Array.isArray(window.__admin.cptes));
  await page.evaluate(() => window.__admin.openCompte('kael'));
  await page.getByRole('button', { name: 'Créer le lien calendrier' }).click();
  await page.waitForFunction(() => /^webcal:\/\/.*planning-ics\?token=[0-9a-f]{48}$/.test(window.__admin.vals().calWebcal));
  const c = db.rows('tech_calendar_connections')[0];
  assert.equal(c.emp, 'kael'); assert.equal(c.provider, 'ics'); assert.equal(c.statut, 'actif');
  const tok1 = c.ics_token;
  await page.getByRole('button', { name: 'Générer un nouveau lien' }).click();
  await page.waitForFunction((t) => !window.__admin.vals().calHttps.endsWith(t), tok1);
  assert.equal(db.rows('tech_calendar_connections').length, 1, 'même ligne, nouveau jeton');
  await page.getByRole('button', { name: 'Révoquer' }).click();
  await page.waitForFunction(() => window.__admin.vals().calOff);
  assert.equal(db.rows('tech_calendar_connections')[0].statut, 'revoque');
  assert.deepEqual(errors, []);
  await page.close();
});
