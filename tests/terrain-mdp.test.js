'use strict';
// sa-terrain — Profil : l'employé change son propre mot de passe (RPC changer_mdp).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('profil : changer son mot de passe (validation, ancien incorrect, succès)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  const appels = [];
  db.rpc.changer_mdp = (b) => { appels.push(b); return b.p_ancien === 'ancien123'; };
  await page.evaluate(() => window.__terrain.go('profil'));
  await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
  const champs = page.locator('#app input[type=password]');
  await champs.nth(0).fill('mauvais1'); await champs.nth(1).fill('court'); await champs.nth(2).fill('court');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText('au moins 8 caractères').waitFor();
  assert.equal(appels.length, 0, 'rien envoyé si trop court');
  await champs.nth(1).fill('nouveau123'); await champs.nth(2).fill('nouveau123');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText('Mot de passe actuel incorrect.').waitFor();
  await champs.nth(0).fill('ancien123');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText('Mot de passe changé').waitFor();
  assert.deepEqual(appels.at(-1), { p_id: 'kael', p_ancien: 'ancien123', p_nouveau: 'nouveau123' });
  assert.equal(await page.locator('#app input[type=password]').count(), 0, 'formulaire refermé');
  assert.ok(!(await page.evaluate(() => localStorage.getItem('sa_terrain_state') || '')).includes('nouveau123'), 'mot de passe jamais persisté');
  assert.deepEqual(errors, []);
});
