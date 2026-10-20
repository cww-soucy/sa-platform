'use strict';
// SA Platform (index.html) — session Supabase Auth (SECURISATION_ETAPE3) : jeton à chaque échange, synchro après la connexion,
// un employé ne renvoie ni les comptes, ni le lien calendrier ou les feuilles des autres.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openPlatform, launch } = require('./harness');
const { base } = require('./fixtures');

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const KAEL = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', statut: 'actif', doit_changer_mdp: false };
async function connexion(page, db, compte, mdp) {
  db.rpc.verifier_connexion = (b) => (b.p_id === compte.id && b.p_mdp === mdp ? [compte] : []);
  await page.waitForFunction(() => window.sbReady === true);
  await page.fill('#loginUser', compte.id); await page.fill('#loginPass', mdp); await page.click('#loginBtn');
  await page.locator('#screenApp.active').waitFor();
}
const lectures = (db, t) => db.log.filter((l) => l.method === 'GET' && l.table === t);

test('connexion : jeton demandé avec le mot de passe ; synchro seulement après, toujours avec le jeton', async () => {
  const { page, db, errors } = await openPlatform(browser, srv.url, { tables: base() });
  await page.waitForFunction(() => window.sbReady === true);
  await page.waitForTimeout(300);
  assert.equal(db.log.filter((l) => !l.table.startsWith('rpc/')).length, 0, 'aucune donnée avant la connexion');
  await connexion(page, db, KAEL, 'Kael-1234');
  await page.waitForFunction(() => window.sbStatus === 'online');
  const pw = db.authLog.find((a) => a.grant === 'password');
  assert.deepEqual([pw.body.email, pw.body.password], ['kael@comptes.soucyaquatik.local', 'Kael-1234']);
  assert.ok(lectures(db, 'workorders').length > 0, 'synchro de démarrage faite après la connexion');
  assert.deepEqual(db.sansJeton, [], 'aucune requête sans jeton');
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('Kael-1234'), 'mot de passe jamais gardé');
  // « Quitter » ferme la session Supabase de l'appareil
  await page.click('#logoutBtn');
  await page.locator('#screenLogin.active').waitFor();
  await page.waitForFunction(() => !Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)));
  assert.ok(db.authLog.some((a) => a.path.endsWith('/logout')));
  assert.deepEqual(errors, []);
  await page.close();
});

test('employé : la liste publique remplace « comptes » ; ni comptes, ni calendrier ni feuille d’un autre renvoyés', async () => {
  const wk = '2026-10-12';
  const local = {
    comptes: [{ id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'admin' }, { id: 'kael2', prenom: 'Autre', nom: 'Tech', role: 'technicien' }],
    calconn: [{ id: 'c-kael', emp: 'kael', icsToken: 'a' }, { id: 'c-kael2', emp: 'kael2', icsToken: 'b' }],
    ['ft_week_kael_' + wk]: { uid: 'kael', week: wk, emp: 'Kaël Test', days: [] },
    ['ft_week_kael2_' + wk]: { uid: 'kael2', week: wk, emp: 'Autre Tech', days: [] },
  };
  const { page, db, errors } = await openPlatform(browser, srv.url, { tables: base(), local });
  db.fail.comptes = 403; // comptes : réservé à la supervision
  await connexion(page, db, KAEL, 'Kael-1234');
  await page.waitForFunction(() => window.sbStatus === 'online');
  await page.waitForTimeout(500);
  assert.ok(lectures(db, 'comptes_publics').length > 0, 'liste publique lue');
  const ecrit = (t) => db.log.filter((l) => l.method === 'POST' && l.table === t).flatMap((l) => [].concat(l.body));
  assert.equal(db.log.filter((l) => l.method !== 'GET' && l.table === 'comptes').length, 0, 'comptes jamais renvoyés par un employé');
  assert.deepEqual(ecrit('tech_calendar_connections').map((r) => r.emp), ['kael']);
  assert.deepEqual([...new Set(ecrit('feuilles_temps').map((r) => r.uid))], ['kael']);
  assert.equal(await page.evaluate(() => document.body.innerText.includes('NON SYNCHRONISÉ')), false);
  assert.deepEqual(db.sansJeton, []);
  assert.deepEqual(errors, []);
  await page.close();
});

test('session gardée sur l’appareil : au rechargement, la synchro part avec le jeton avant même l’écran de connexion', async () => {
  const { page, db } = await openPlatform(browser, srv.url, { tables: base() });
  await connexion(page, db, KAEL, 'Kael-1234');
  await page.waitForFunction(() => window.sbStatus === 'online');
  const n = lectures(db, 'workorders').length;
  await page.reload();
  await page.waitForFunction(() => window.sbStatus === 'online');
  assert.ok(lectures(db, 'workorders').length > n, 'nouvelle synchro au démarrage');
  assert.deepEqual(db.sansJeton, []);
  await page.close();
});
