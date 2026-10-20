'use strict';
// sa-terrain et sa-admin — jeton de session (Supabase Auth, SECURISATION_ETAPE3) : envoyé à chaque requête, renouvelé
// à l'expiration (même après des heures hors réseau), file d'envoi jamais vidée quand il faut se reconnecter.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const file = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length);
const session = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), k || 'sa_terrain_user');

for (const C of [{ app: 'terrain', compte: Object.assign({ doit_changer_mdp: false }, USER), cle: 'sa_terrain_user', pret: () => !!(window.__terrain && window.__terrain.syncAt) },
  { app: 'admin', compte: Object.assign({ doit_changer_mdp: false }, ADMIN), cle: 'sa_admin_user', pret: () => !!(window.__admin && window.__admin.D) }]) {
  test(C.app + ' : connexion → jeton gardé (jamais le mot de passe) ; chaque requête le porte, jamais la clé publique seule', async () => {
    const { page, db, errors } = await openApp(browser, srv.url, { app: C.app, user: null, tables: base() });
    db.rpc.verifier_connexion = (b) => (b.p_mdp === 'Bon-12345' ? [C.compte] : []);
    await page.fill('#lu', C.compte.id); await page.fill('#lp', 'Bon-12345'); await page.click('#loginForm button[type=submit]');
    await page.waitForFunction(C.pret);
    const pw = db.authLog.find((a) => a.grant === 'password');
    assert.deepEqual(pw.body, { email: C.compte.id + '@comptes.soucyaquatik.local', password: 'Bon-12345' });
    const u = await session(page, C.cle);
    assert.match(u.auth.access_token, new RegExp('^jeton-' + C.compte.id + '-'));
    const ls = await page.evaluate(() => JSON.stringify(localStorage));
    assert.ok(!ls.includes('Bon-12345'), 'mot de passe jamais gardé');
    assert.deepEqual(db.sansJeton, [], 'aucune requête de données sans jeton');
    assert.ok(db.log.filter((l) => !l.table.startsWith('rpc/')).length > 3);
    // Se déconnecter : la session est révoquée au serveur
    await page.evaluate((app) => (app === 'terrain' ? window.__terrain : window.__admin).vals().logout(), C.app);
    await page.locator('#login').waitFor();
    assert.ok(db.authLog.some((a) => a.path.endsWith('/logout')));
    assert.deepEqual(errors, []);
    await page.close();
  });
}

test('terrain : punch et fiche faits hors réseau partent au retour du réseau, même si le jeton a expiré entre-temps', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await page.context().setOffline(true);
  await page.evaluate(() => {
    const t = window.__terrain; t.openPunchForm(null); t.setState({ pf: Object.assign({}, t.state.pf, { siteId: '1', lieu: 'Piscine Alpha' }) }); t.submitPunch();
    t.enqueue({ _t: 'releves', id: 'hr-jeton', site_id: '1', tech: 'kael', tech_nom: 'Kaël Test', date: '2026-10-20', vals: {} });
  });
  await page.waitForFunction(() => window.__terrain.ops().length > 0 && JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 1);
  // Une heure passe sans réseau : le jeton expire (le serveur ne l'accepte plus)
  const ancien = await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('sa_terrain_user')); u.auth.expires_at = Math.floor(Date.now() / 1000) - 60; localStorage.setItem('sa_terrain_user', JSON.stringify(u)); return u.auth.access_token; });
  db.jetons.delete(ancien);
  await page.context().setOffline(false);
  await page.evaluate(() => { window.__terrain.flush(); window.__terrain.flushOps(); });
  await page.waitForFunction(() => window.__terrain.ops().length === 0 && JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0, null, { timeout: 15000 });
  assert.ok(db.rows('releves').some((r) => r.id === 'hr-jeton'), 'fiche reçue');
  assert.ok(db.rows('feuilles_temps')[0].days.some((d) => (d.tasks || []).some((t) => t.lieu === 'Piscine Alpha')), 'punch reçu');
  assert.equal(db.authLog.filter((a) => a.grant === 'refresh_token').length, 1, 'un seul renouvellement');
  assert.notEqual((await session(page)).auth.access_token, ancien);
  assert.deepEqual(db.sansJeton, []);
  assert.deepEqual(errors.filter((e) => !/Failed to fetch|internetdisconnected|ERR_INTERNET/i.test(e)), []);
  await page.close();
});

test('terrain : jeton refusé avant son heure (révoqué) → renouvelé, puis la requête est rejouée', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  db.jetons.clear();
  await page.evaluate(() => window.__terrain.enqueue({ _t: 'demandes', id: 'dm-jeton', tech: 'kael', type: 'Matériel', texte: 'x' }));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  assert.ok(db.rows('demandes').some((d) => d.id === 'dm-jeton'));
  assert.ok(db.sansJeton.includes('POST demandes'), 'refusée une fois, puis rejouée avec le nouveau jeton');
  assert.equal(db.authLog.filter((a) => a.grant === 'refresh_token').length, 1, 'un seul renouvellement');
  await page.close();
});

test('terrain : renouvellement refusé (compte désactivé) → écran de connexion, fiches gardées sur le téléphone', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  db.jetons.clear(); db.renouv.clear();
  await page.evaluate(() => window.__terrain.enqueue({ _t: 'releves', id: 'hr-garde', site_id: '1', tech: 'kael', date: '2026-10-20', vals: {} }));
  await page.locator('#login').getByText('Session expirée — reconnectez-vous. Vos fiches en attente restent sur le téléphone.').waitFor();
  assert.equal(await page.inputValue('#lu'), 'kael');
  assert.equal(await file(page), 1, 'fiche gardée');
  // reconnexion : la fiche part
  db.rpc.verifier_connexion = () => [Object.assign({ doit_changer_mdp: false }, USER)];
  await page.fill('#lp', 'Bon-12345'); await page.click('#loginForm button[type=submit]');
  await page.waitForFunction(() => window.__terrain && JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  assert.ok(db.rows('releves').some((r) => r.id === 'hr-garde'));
  await page.close();
});

test('terrain : session ouverte avant les jetons — marche tant que la base accepte la clé publique, puis demande la connexion', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: Object.assign({ auth: null }, USER), tables: base(), jeton: false }); // base avant SECURISATION_ETAPE3.sql
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await page.evaluate(() => window.__terrain.enqueue({ _t: 'releves', id: 'hr-anon', site_id: '1', tech: 'kael', date: '2026-10-20', vals: {} }));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  assert.equal(await page.locator('#login').isVisible(), false);
  db.exigeJeton = true; // SECURISATION_ETAPE3.sql appliquée
  await page.evaluate(() => window.__terrain.enqueue({ _t: 'releves', id: 'hr-apres', site_id: '1', tech: 'kael', date: '2026-10-20', vals: {} }));
  await page.locator('#login').getByText('Session expirée').waitFor();
  assert.equal(await file(page), 1, 'fiche gardée');
  await page.close();
});

test('admin : jeton expiré renouvelé avant la requête ; refusé → écran de connexion', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => { const u = JSON.parse(localStorage.getItem('sa_admin_user')); u.auth.expires_at = 1; localStorage.setItem('sa_admin_user', JSON.stringify(u)); });
  await page.evaluate(() => window.__admin.reloadAll());
  assert.equal(db.authLog.filter((a) => a.grant === 'refresh_token').length, 1, 'un seul renouvellement pour toutes les lectures');
  assert.deepEqual(db.sansJeton, []);
  db.jetons.clear(); db.renouv.clear();
  await page.evaluate(() => window.__admin.reloadAll());
  await page.locator('#login').getByText('Session expirée — reconnectez-vous.').waitFor();
  await page.close();
});
