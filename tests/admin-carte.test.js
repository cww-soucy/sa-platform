'use strict';
// sa-admin — Carte : position des sites (fiche ou médiane des punchs précis), corrections, tournée d'un technicien, géolocalisation des adresses.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);

function tables() {
  const t = base(), d = today();
  t.punch_gps_log = [
    { id: 'a1', site_id: 1, emp: 'Kaël Test', lat: 46.8100, lng: -71.2100, acc: 8, date: d, heure: '08:00', lieu: 'Piscine Alpha' },
    { id: 'a2', site_id: 1, emp: 'Kaël Test', lat: 46.8102, lng: -71.2102, acc: 12, date: d, heure: '09:15', lieu: 'Piscine Alpha' },
    { id: 'a3', site_id: 1, emp: 'Kaël Test', lat: 46.8300, lng: -71.2500, acc: 350, date: d, heure: '12:00', lieu: 'Piscine Alpha' },
    { id: 'b1', site_id: 2, emp: 'Kaël Test', lat: 46.7900, lng: -71.1800, acc: 15, date: d, heure: '13:30', lieu: 'Piscine Beta' },
  ];
  return t;
}
async function carte(page) { await page.waitForFunction(() => window.__admin && window.__admin.D); await page.evaluate(() => window.__admin.go('carte')); await page.waitForFunction(() => window.__admin._map); }

test('carte : un punch imprécis ne déplace plus le site ; filtre de précision', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await carte(page);
  const g = await page.evaluate(() => window.__admin.carteGeo().sites.find((s) => s.id === '1'));
  assert.ok(Math.abs(g.lat - 46.8101) < 0.0002 && Math.abs(g.lng + 71.2101) < 0.0002, 'médiane des punchs précis');
  assert.equal(g.src, 'punchs');
  await page.getByLabel('Précision des punchs').selectOption('500');
  const g2 = await page.evaluate(() => window.__admin.carteGeo().sites.find((s) => s.id === '1'));
  assert.ok(Math.abs(g2.lat - 46.8102) < 0.0003, 'médiane robuste même avec le punch à ± 350 m');
  await page.getByText(/site\(s\) placé\(s\) par leur fiche · 2 d’après les punchs précis/).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('carte : garder la position dans la fiche, puis corriger en cliquant sur la carte', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await carte(page);
  await page.evaluate(() => window.__admin.setSiteGps('1', 46.81, -71.21, 'test'));
  await toast(page, /Position de « Piscine Alpha » enregistrée/);
  assert.deepEqual(db.rows('sites').find((s) => String(s.id) === '1').gps, { lat: 46.81, lng: -71.21 });
  await page.evaluate(() => window.__admin.setState({ carteFix: '2' }));
  await page.getByText('Cliquez sur la carte à l’endroit exact de « Piscine Beta »').waitFor();
  // vrai clic de souris, sur une zone vide de la carte (centrée loin des marqueurs)
  await page.evaluate(() => window.__admin._map.setView([46.70, -71.40], 14, { animate: false }));
  const box = await page.locator('#mapSlot .leaflet-container').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await toast(page, /Position de « Piscine Beta » enregistrée/);
  assert.ok(db.rows('sites').find((s) => String(s.id) === '2').gps.lat);
  await page.close();
});

test('carte : tournée d’un technicien (ordre, distance) et géolocalisation des adresses', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.route('https://nominatim.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ lat: '46.85', lon: '-71.30' }]) }));
  await carte(page);
  await page.getByLabel('Technicien').selectOption('Kaël Test');
  await page.waitForFunction(() => window.__admin.vals().cTour.length === 4);
  const t = await page.evaluate(() => window.__admin.vals().cTour.map((p) => p.txt));
  assert.deepEqual(t, ['08:00 · Piscine Alpha', '09:15 · Piscine Alpha', '12:00 · Piscine Alpha', '13:30 · Piscine Beta']);
  await page.getByText(/Distance à vol d’oiseau : \d+,?\.?\d* km/).waitFor();
  // site 4 (Piscine Alpha Sud) n'a ni position ni adresse ; on lui donne une adresse
  db.rows('sites').find((s) => String(s.id) === '4').addr = '9 rue Z, Québec';
  await page.evaluate(() => window.__admin.reloadAll());
  await page.getByRole('button', { name: 'Placer ces sites d’après leur adresse' }).click();
  await toast(page, /Géolocalisation terminée : 1 site\(s\) placé\(s\)/);
  assert.deepEqual(db.rows('sites').find((s) => String(s.id) === '4').gps, { lat: 46.85, lng: -71.3, src: 'adresse' });
  await page.close();
});
