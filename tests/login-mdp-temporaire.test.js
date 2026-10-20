'use strict';
// sa-terrain et sa-admin — mot de passe temporaire (doit_changer_mdp) : la personne choisit son nouveau mot de passe
// directement sur l'écran de connexion, puis la session s'ouvre (avant : renvoyée vers SA Platform).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const CAS = [
  { app: 'terrain', compte: { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '' }, cle: 'sa_terrain_user', pret: () => !!window.__terrain },
  { app: 'admin', compte: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' }, cle: 'sa_admin_user', pret: () => !!window.__admin },
];

for (const C of CAS) {
  test(C.app + ' : mot de passe temporaire → « Choisissez votre nouveau mot de passe », puis la session s’ouvre', async () => {
    const { page, db, errors } = await openApp(browser, srv.url, { app: C.app, user: null, tables: base() });
    let mdp = 'Temp-2026';
    const appels = [];
    db.rpc.verifier_connexion = (b) => (b.p_id === C.compte.id && b.p_mdp === mdp ? [Object.assign({ doit_changer_mdp: mdp === 'Temp-2026' }, C.compte)] : []);
    db.rpc.changer_mdp = (b) => { appels.push(b); if (b.p_ancien !== mdp) return false; mdp = b.p_nouveau; return true; };
    await page.fill('#lu', C.compte.id); await page.fill('#lp', 'Temp-2026'); await page.click('#loginForm button[type=submit]');
    const f = page.locator('#mdpForm');
    await f.getByText('Choisissez votre nouveau mot de passe').waitFor();
    assert.equal(await page.locator('#loginForm').isVisible(), false);
    // trop court : refusé sans appel serveur
    await page.fill('#ln', 'court'); await page.fill('#lc', 'court'); await f.locator('button[type=submit]').click();
    await f.getByText('Le nouveau mot de passe doit contenir au moins 8 caractères.').waitFor();
    await page.fill('#ln', 'Nouveau-2026'); await page.fill('#lc', 'Nouveau-2027'); await f.locator('button[type=submit]').click();
    await f.getByText('La confirmation ne correspond pas.').waitFor();
    await page.fill('#ln', 'Temp-2026'); await page.fill('#lc', 'Temp-2026'); await f.locator('button[type=submit]').click();
    await f.getByText('Le nouveau mot de passe doit être différent de l’actuel.').waitFor();
    assert.equal(appels.length, 0, 'aucun appel serveur tant que le formulaire est invalide');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), C.cle), null, 'pas de session avant le changement');
    // réseau coupé : message clair, rien d'enregistré
    await page.route('**/rest/v1/rpc/changer_mdp', (r) => r.abort('failed'));
    await page.fill('#ln', 'Nouveau-2026'); await page.fill('#lc', 'Nouveau-2026'); await f.locator('button[type=submit]').click();
    await f.getByText('Réseau indisponible — réessayez.').waitFor();
    await page.unroute('**/rest/v1/rpc/changer_mdp');
    await f.locator('button[type=submit]').click();
    await page.waitForFunction(C.pret);
    assert.deepEqual(appels.at(-1), { p_id: C.compte.id, p_ancien: 'Temp-2026', p_nouveau: 'Nouveau-2026' });
    const ls = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
    assert.equal(JSON.parse(JSON.parse(ls)[C.cle]).id, C.compte.id, 'session ouverte normalement');
    assert.ok(!/Temp-2026|Nouveau-2026/.test(ls), 'aucun mot de passe dans localStorage');
    assert.deepEqual(errors, []);
    await page.close();
  });
}
