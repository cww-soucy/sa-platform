'use strict';
// SA Platform (index.html) — bouton « 🔒 Mot de passe » de la barre du haut : changer son mot de passe à volonté.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openPlatform, launch } = require('./harness');
const { base } = require('./fixtures');

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('connecté, « 🔒 Mot de passe » ouvre la fenêtre ; ancien faux refusé ; bon → rpc/changer_mdp', async () => {
  const { page, db, errors } = await openPlatform(browser, srv.url, { tables: base() });
  const appels = [];
  db.rpc.verifier_connexion = (b) => (b.p_id === 'kael' && b.p_mdp === 'ancien123' ? [{ id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', statut: 'actif', doit_changer_mdp: false }] : []);
  db.rpc.changer_mdp = (b) => { appels.push(b); return b.p_ancien === 'ancien123'; };
  await page.waitForFunction(() => window.sbReady === true);
  await page.fill('#loginUser', 'kael');
  await page.fill('#loginPass', 'ancien123');
  await page.click('#loginBtn');
  await page.locator('#screenApp.active').waitFor();
  const btn = page.locator('#mdpBtn');
  assert.equal((await btn.innerText()).trim(), '🔒 Mot de passe');
  await btn.click();
  await page.locator('#mdpModal').getByText('Changer mon mot de passe').waitFor();
  await page.fill('#mdpAncien', 'mauvais1');
  await page.fill('#mdpNouveau', 'nouveau123');
  await page.fill('#mdpConfirme', 'nouveau123');
  await page.click('#mdpSave');
  await page.locator('#mdpErr', { hasText: 'Mot de passe actuel incorrect.' }).waitFor();
  await page.fill('#mdpAncien', 'ancien123');
  await page.click('#mdpSave');
  await page.waitForFunction(() => !document.getElementById('mdpModal').classList.contains('open'));
  assert.match(await page.locator('#mdpErr').innerText(), /^(Enregistrement…)?$/);
  assert.deepEqual(appels.map((a) => a.p_ancien), ['mauvais1', 'ancien123']);
  assert.deepEqual(appels.at(-1), { p_id: 'kael', p_ancien: 'ancien123', p_nouveau: 'nouveau123' });
  assert.deepEqual(errors, []);
  await page.close();
});
