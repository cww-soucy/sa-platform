'use strict';
// sa-terrain — saisie des relevés : pas calibré, saisie au clavier, ± maintenus, curseur, °C / °F.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const TEMP = { key: 'temp', label: 'Température', unit: '°C', kind: 'range', icon: 'thermo', min: 14, max: 32, lo: 25, hi: 29, step: 0.5 };
function tables() { const t = base(); t.types_bassin[1].fields.push(TEMP); return t; }
const fld = (page, k) => page.evaluate((k) => { const f = window.__terrain.vals().fields.find((x) => x.key === k); return { val: f.val, unit: f.unit, min: f.minTxt, max: f.maxTxt, zone: f.zoneTxt, ok: f.ok, bad: f.bad }; }, k);
const raw = (page, k) => page.evaluate((k) => { const t = window.__terrain; return (t.state.vals[t.vals().cur.sid] || {})[k]; }, k);

async function ouvrir(page) {
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await page.evaluate(() => { try { localStorage.removeItem('sa_terrain_temp_f'); } catch (e) {} window.__terrain.open('wo:wo-mine'); });
  await page.getByRole('button', { name: 'Continuer : Eau du bassin' }).click();
}

test('pas calibré : un pas trop grossier pour la zone est ramené à une valeur ronde', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  const s = await page.evaluate(() => {
    const t = window.__terrain;
    return [t.stepOf({ kind: 'range', step: 0.5, min: 7.2, max: 7.8, lo: 7.3, hi: 7.6 }), t.stepOf({ kind: 'range', step: 0.1, min: 0, max: 5, lo: 1, hi: 3 }),
      t.stepOf({ kind: 'range', step: 0.5, min: 14, max: 32, lo: 25, hi: 29 }), t.stepOf({ kind: 'count', step: 1, min: 0, max: 14, lo: 0, hi: 0 })];
  });
  assert.deepEqual(s, [0.1, 0.1, 0.5, 1]);
  await page.close();
});

test('saisie au clavier : toucher la valeur, virgule acceptée, 2 décimales, hors échelle permis', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ouvrir(page);
  await page.getByRole('button', { name: 'Saisir pH au clavier' }).click();
  const box = page.getByRole('textbox', { name: 'Saisir pH au clavier' });
  await box.waitFor();
  // le focus est posé juste après le rendu (setTimeout 0) : on l'attend au lieu de le lire tout de suite
  await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('data-num') === 'ph', null, { timeout: 2000 });
  await box.fill('7,45');
  await box.press('Enter');
  await page.getByRole('button', { name: 'Saisir pH au clavier' }).waitFor();
  assert.equal(await raw(page, 'ph'), 7.45);
  assert.equal((await fld(page, 'ph')).val, '7,45');
  assert.equal((await fld(page, 'ph')).ok, true);
  // chlore à 6 : au-delà de l'échelle du curseur (0–5), gardé tel quel et signalé hors zone
  await page.getByRole('button', { name: 'Saisir Chlore libre au clavier' }).click();
  await page.getByRole('textbox', { name: 'Saisir Chlore libre au clavier' }).fill('6');
  await page.getByRole('textbox', { name: 'Saisir Chlore libre au clavier' }).press('Enter');
  await page.waitForFunction(() => { const t = window.__terrain; return (t.state.vals[t.vals().cur.sid] || {}).cl === 6; });
  assert.equal((await fld(page, 'cl')).bad, true);
  // Échap : annule sans rien changer
  await page.getByRole('button', { name: 'Saisir pH au clavier' }).click();
  await page.getByRole('textbox', { name: 'Saisir pH au clavier' }).fill('9');
  await page.getByRole('textbox', { name: 'Saisir pH au clavier' }).press('Escape');
  assert.equal(await raw(page, 'ph'), 7.45);
  assert.deepEqual(errors, []);
  await page.close();
});

test('± maintenus et curseur : la valeur avance en continu, au pas calibré', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ouvrir(page);
  const plus = page.getByRole('button', { name: 'Augmenter' }).first();
  const b = await plus.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  const v = await raw(page, 'ph');
  assert.ok(v >= 7.4 + 0.5, 'plusieurs crans en restant appuyé (' + v + ')');
  await page.waitForTimeout(300);
  assert.equal(await raw(page, 'ph'), v, 's’arrête au relâchement');
  // curseur : glisser jusqu'au bord droit, le doigt sorti de la règle reste suivi
  const ruler = page.locator('[style*="touch-action:none"]').first();
  const r = await ruler.boundingBox();
  await page.mouse.move(r.x + 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2, r.y + 200, { steps: 5 });
  await page.mouse.move(r.x + r.width + 50, r.y + 200, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(await raw(page, 'ph'), 8.2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('température : °C ou °F au choix (gardé sur le téléphone), toujours enregistrée en °C', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ouvrir(page);
  assert.deepEqual(await fld(page, 'temp'), { val: '27,0', unit: '°C', min: '14,0', max: '32,0', zone: '25,0 – 29,0', ok: false, bad: false });
  await page.getByRole('group', { name: 'Unité de température' }).getByRole('button', { name: '°F' }).click();
  assert.deepEqual(await fld(page, 'temp'), { val: '81', unit: '°F', min: '57', max: '90', zone: '77 – 84', ok: false, bad: false });
  assert.equal(await page.evaluate(() => localStorage.getItem('sa_terrain_temp_f')), '1');
  // saisie en °F → enregistrée en °C
  await page.getByRole('button', { name: 'Saisir Température au clavier' }).click();
  await page.getByRole('textbox', { name: 'Saisir Température au clavier' }).fill('80');
  await page.getByRole('textbox', { name: 'Saisir Température au clavier' }).press('Enter');
  await page.waitForFunction(() => { const t = window.__terrain; return (t.state.vals[t.vals().cur.sid] || {}).temp != null; });
  assert.equal(await raw(page, 'temp'), 26.67);
  assert.equal((await fld(page, 'temp')).val, '80');
  // + en °F : un degré Fahrenheit de plus
  await page.evaluate(() => window.__terrain.vals().fields.find((x) => x.key === 'temp').plus());
  assert.equal((await fld(page, 'temp')).val, '81');
  assert.equal(await raw(page, 'temp'), 27.22);
  // retour en °C
  await page.getByRole('group', { name: 'Unité de température' }).getByRole('button', { name: '°C' }).click();
  assert.equal((await fld(page, 'temp')).val, '27,22');
  assert.deepEqual(errors, []);
  await page.close();
});

test('refaire un test au même site sans dépuncher : nouvelle fiche, la première est gardée (2 relevés distincts)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt && window.__terrain.jobs.length);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  await page.waitForFunction(() => window.__terrain.vals().fields.length > 1);
  await page.evaluate(() => { const t = window.__terrain; t.vals().fields[0].plus(); t.vals().validate(); });
  await page.getByText(/Fiche validée à/).first().waitFor();
  await page.getByRole('button', { name: 'Refaire un test (nouvelle fiche)' }).click();
  // fiche vierge : plus « validée », valeurs à saisir
  assert.equal(await page.evaluate(() => window.__terrain.vals().cur.isValidated), false);
  assert.equal(await page.evaluate(() => window.__terrain.vals().fields.filter((f) => !f.pending).length), 0);
  await page.evaluate(() => { const t = window.__terrain; t.vals().fields[1].plus(); t.vals().validate(); });
  await page.waitForFunction(() => window.__terrain.vals().cur.isValidated);
  await page.waitForFunction(() => !window.__terrain.queueN);
  const rel = db.rows('releves').filter((r) => r.tech === 'kael' && r.site_id === '1');
  assert.equal(rel.length, 2, 'les deux fiches sont au bureau');
  assert.notEqual(rel[0].id, rel[1].id);
  assert.deepEqual(rel.map((r) => Object.keys(r.touched).join(',')).sort(), ['cl', 'ph']);
  assert.deepEqual(errors, []);
  await page.close();
});
