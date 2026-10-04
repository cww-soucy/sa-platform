'use strict';
// sa-terrain — salle mécanique sans réseau : les photos vont dans IndexedDB (pas dans localStorage, plafonné à ~5 Mo),
// la fiche attend le retour du réseau, la tournée du jour reste affichée sans réseau.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('hors réseau : 30 photos gardées hors de localStorage, puis envoyées au retour du réseau', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await page.context().setOffline(true);
  // ~300 Ko par photo × 30 = ~9 Mo : dépasse largement localStorage
  await page.evaluate(() => {
    const big = (i) => 'data:image/jpeg;base64,' + String.fromCharCode(65 + (i % 26)).repeat(300000);
    for (let i = 0; i < 30; i++) window.__terrain.enqueue({ _t: 'releves', id: 'hr-' + i, site_id: 's1', date: '2026-10-04', photo: big(i), points: { 'MI-0': { etat: 'ok', photos: [big(i + 1)] } } });
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 30);
  const q = await page.evaluate(() => localStorage.getItem('sa_terrain_queue'));
  assert.ok(q.length < 20000, 'la file ne garde que des références');
  assert.ok(!/data:image/.test(q));
  await page.getByText('30 fiche(s) à envoyer').count();
  await page.context().setOffline(false);
  await page.evaluate(() => window.__terrain.flush());
  await page.waitForFunction(() => !window.__terrain._pend && JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0, null, { timeout: 30000 });
  const r = db.rows('releves').find((x) => x.id === 'hr-7');
  assert.equal(r.photo, 'data:image/jpeg;base64,' + 'H'.repeat(300000));
  assert.equal(r.points['MI-0'].photos[0], 'data:image/jpeg;base64,' + 'I'.repeat(300000));
  assert.deepEqual(errors, []);
  await page.close();
});

test('hors réseau : photos d’un point et tournée du jour retrouvées après réouverture de la page', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  const nJobs = await page.evaluate(() => window.__terrain.jobs.length);
  assert.ok(nJobs > 0);
  const ph = 'data:image/jpeg;base64,' + 'Z'.repeat(50000);
  await page.evaluate((ph) => window.__terrain.setPt('s1', 'MI-0', { etat: 'action', photos: [ph] }), ph);
  await page.waitForFunction(() => /idb:/.test(Object.keys(localStorage).filter((k) => /^sa_terrain_state_/.test(k)).map((k) => localStorage.getItem(k)).join('')));
  // Réouverture sans réseau : Supabase injoignable
  await page.unroute('https://ldqvdiaewvhnukuaxdmc.supabase.co/**');
  await page.route('https://ldqvdiaewvhnukuaxdmc.supabase.co/**', (r) => r.abort('internetdisconnected'));
  await page.reload();
  await page.waitForFunction((ph) => { const t = window.__terrain; return t && t.state.pts && t.state.pts.s1 && t.state.pts.s1['MI-0'].photos[0] === ph; }, ph);
  assert.equal(await page.evaluate(() => window.__terrain.jobs.length), nJobs, 'tournée affichée depuis le téléphone');
  assert.deepEqual(errors.filter((e) => !/réseau|internetdisconnected|Failed to fetch/i.test(e)), []);
  await page.close();
});
