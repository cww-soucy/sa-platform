'use strict';
// Carnet de bord Salle Mécanique (QR) : page qr-carnet/?site=ID et connecteur src/services/waterLogConnector.js (Port IN / OUT).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, FakeDB } = require('./harness');
const { base } = require('./fixtures');

const SB = 'https://ldqvdiaewvhnukuaxdmc.supabase.co';
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

// En-têtes de /qr-carnet/* lus dans _headers (comme Cloudflare Pages) : la page doit fonctionner sous sa CSP stricte.
const HEADERS = (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', '_headers'), 'utf8');
  const block = src.split('\n/qr-carnet/*\n')[1].split(/\n\s*\n/)[0];
  return Object.fromEntries(block.split('\n').map((l) => l.trim().match(/^([\w-]+):\s*(.+)$/)).filter(Boolean).map((m) => [m[1].toLowerCase(), m[2]]));
})();

async function open(query, { tables, fail, tech } = {}) {
  const db = new FakeDB(tables || base());
  Object.assign(db.fail, fail || {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.exposeFunction('__csp', (v) => errors.push('csp: ' + v));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.__csp(e.violatedDirective + ' ' + e.blockedURI)));
  await page.route(SB + '/**', (r) => db.handle(r));
  await page.route(/\/qr-carnet\//, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), ...HEADERS } }); });
  await page.route(/cdn\.jsdelivr\.net/, (r) => r.abort()); // la page QR ne charge jamais supabase-js
  await page.addInitScript((t) => { if (!sessionStorage.getItem('__init')) { localStorage.clear(); if (t) localStorage.setItem('sa_qr_carnet_tech', JSON.stringify(t)); sessionStorage.setItem('__init', '1'); } }, tech || null);
  await page.goto(srv.url + '/qr-carnet/' + query);
  await page.waitForFunction(() => window.__qrCarnet);
  return { page, db, errors };
}
async function fill(page, v) {
  for (const [k, x] of Object.entries(v)) await page.fill('#' + k, x);
}

test('saisie conforme : site détecté, insertion water_logs, événement waterlog:submitted, nom retenu', async () => {
  const { page, db, errors } = await open('?site=1');
  await page.getByText('Piscine Alpha').waitFor();
  await page.evaluate(() => { window.__evt = []; addEventListener('waterlog:submitted', (e) => window.__evt.push(e.detail)); });
  await fill(page, { technician_name: 'Kaël Test', ph_level: '7,4', free_chlorine: '1,2', water_temp: '28', alkalinity: '100', notes: 'Filtre lavé' });
  assert.match(await page.getAttribute('[data-field="ph_level"]', 'class'), /\bok\b/, 'pH dans la norme en vert');
  await page.getByRole('button', { name: 'Enregistrer le relevé' }).click();
  await page.getByText('Toutes les valeurs sont dans les normes.').waitFor();
  const rows = db.rows('water_logs');
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { site_id: '1', technician_name: 'Kaël Test', ph_level: 7.4, free_chlorine: 1.2, water_temp: 28, alkalinity: 100, notes: 'Filtre lavé' });
  const evt = await page.evaluate(() => window.__evt);
  assert.equal(evt.length, 1);
  assert.equal(evt[0].ph_level, 7.4);
  assert.deepEqual(evt[0].alerts, []);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sa_qr_carnet_tech'))), 'Kaël Test');
  // relevé suivant : le nom est déjà rempli
  await page.getByRole('button', { name: 'Nouveau relevé' }).click();
  assert.equal(await page.inputValue('#technician_name'), 'Kaël Test');
  assert.equal(await page.inputValue('#ph_level'), '');
  assert.deepEqual(errors, []);
  await page.close();
});

test('hors norme : enregistré quand même avec alerte critique ; valeur manquante ou impossible refusée sans écriture', async () => {
  const { page, db, errors } = await open('?site=1', { tech: 'Kaël Test' });
  await fill(page, { ph_level: '7,4' });
  await page.getByRole('button', { name: 'Enregistrer le relevé' }).click();
  await page.getByText('Chlore libre requis').waitFor();
  await fill(page, { ph_level: '17', free_chlorine: '1' });
  await page.getByRole('button', { name: 'Enregistrer le relevé' }).click();
  await page.getByText('pH invalide (entre 0 et 14)').waitFor();
  assert.equal(db.writes('water_logs').length, 0, 'aucune écriture tant que le relevé est invalide');
  await fill(page, { ph_level: '8,1', free_chlorine: '0,4' });
  assert.match(await page.getAttribute('[data-field="free_chlorine"]', 'class'), /\bcrit\b/);
  await page.getByRole('button', { name: 'Enregistrer le relevé' }).click();
  await page.getByText(/Valeurs hors norme/).waitFor();
  await page.getByText('pH trop élevé : 8,1 (norme 7,2–7,8)').waitFor();
  await page.getByText('Chlore libre trop bas : 0,4 mg/L (norme 0,8–2 mg/L)').waitFor();
  assert.equal(db.rows('water_logs').length, 1);
  assert.equal(db.rows('water_logs')[0].water_temp, null, 'champ facultatif vide → null');
  assert.deepEqual(errors, []);
  await page.close();
});

test('hors ligne : relevé conservé sur l’appareil puis envoyé au retour du réseau, avec l’heure de la mesure', async () => {
  const { page, db } = await open('?site=1', { tech: 'Kaël Test', fail: { water_logs: 'network' } });
  await fill(page, { ph_level: '7,5', free_chlorine: '1,5' });
  await page.getByRole('button', { name: 'Enregistrer le relevé' }).click();
  await page.getByText('Relevé conservé sur l’appareil').waitFor();
  await page.getByText(/1 relevé en attente d'envoi/).waitFor();
  assert.equal(db.rows('water_logs').length, 0);
  delete db.fail.water_logs;
  await page.evaluate(() => window.__qrCarnet.flush());
  await page.waitForFunction(() => !window.__qrCarnet.queue().length);
  const rows = db.rows('water_logs');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ph_level, 7.5);
  assert.match(rows[0].created_at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(await page.locator('#pending').isHidden(), true);
  await page.close();
});

test('section cloisonnée : CSP stricte appliquée, aucun lien vers le reste de la plateforme', async () => {
  assert.match(HEADERS['content-security-policy'], /script-src 'self';/);
  assert.match(HEADERS['content-security-policy'], /frame-ancestors 'none'/);
  const { page, errors } = await open('?site=1');
  await page.getByText('Piscine Alpha').waitFor();
  assert.equal(await page.locator('a[href]').count(), 0, 'aucun lien sortant');
  const blocked = await page.evaluate(() => fetch('https://exemple.invalid/').then(() => 'ok', () => 'bloqué'));
  assert.equal(blocked, 'bloqué');
  assert.deepEqual(errors.filter((e) => !/exemple\.invalid/.test(e)), []);
  await page.close();
});

test('sans ?site= : formulaire masqué, invitation à scanner le QR ; site inconnu signalé', async () => {
  let { page } = await open('');
  await page.getByText('Aucun site détecté.').waitFor();
  assert.equal(await page.locator('#f').isHidden(), true);
  await page.close();
  ({ page } = await open('?site=zzz'));
  await page.getByText('Le site « zzz » n\'existe pas dans la plateforme.', { exact: false }).waitFor();
  await page.close();
});

test('Port OUT : getLogs (filtres PostgREST) et subscribeToWaterLogs (Realtime) avec le client de la plateforme', async () => {
  const t = base();
  t.water_logs = [
    { id: 1, site_id: '1', technician_name: 'A', ph_level: 7.4, free_chlorine: 1, created_at: '2026-10-01T12:00:00Z' },
    { id: 2, site_id: '2', technician_name: 'B', ph_level: 7.9, free_chlorine: 1, created_at: '2026-10-01T13:00:00Z' },
  ];
  const { page, db, errors } = await open('?site=1', { tables: t });
  const out = await page.evaluate(async () => {
    const m = await import('/src/services/waterLogConnector.js');
    const rows = await m.getLogs('1', { from: '2026-10-01T00:00:00Z', limit: 50, ascending: true });
    // faux client supabase-js : vérifie le filtre du canal et transmet un INSERT
    let handler, filter, unsub = 0;
    const client = { channel: () => ({ on(_e, f, cb) { filter = f; handler = cb; return this; }, subscribe() { return this; }, unsubscribe() { unsub++; } }) };
    m.configureWaterLogConnector({ client });
    const got = [];
    const stop = m.subscribeToWaterLogs('1', (log, meta) => got.push([log.id, meta.alerts.map((a) => a.field)]));
    await new Promise((r) => setTimeout(r, 0));
    handler({ new: { id: 9, site_id: '1', ph_level: 6.9, free_chlorine: 1 } });
    stop();
    return { rows, filter, got, unsub };
  });
  assert.deepEqual(out.rows.map((r) => r.id), [1], 'filtre site_id appliqué');
  const q = db.log.find((l) => l.table === 'water_logs' && l.method === 'GET' && /gte/.test(l.query)).query;
  assert.match(q, /order=created_at\.asc/);
  assert.match(q, /limit=50/);
  assert.match(decodeURIComponent(q), /created_at=gte\.2026-10-01T00:00:00Z/);
  assert.deepEqual(out.filter, { event: 'INSERT', schema: 'public', table: 'water_logs', filter: 'site_id=eq.1' });
  assert.deepEqual(out.got, [[9, ['ph_level']]]);
  assert.equal(out.unsub, 1);
  assert.deepEqual(errors, []);
  await page.close();
});
