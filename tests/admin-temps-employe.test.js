'use strict';
// sa-admin — Temps · « Par employé » : la feuille d'un employé, avec le détail des punchs et les actions de publication.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, dayIdx, weekKey } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const A = (page, fn, arg) => page.evaluate(fn, arg);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);

function tables() {
  const t = base();
  const d = t.feuilles_temps[0].days[dayIdx()];
  d.tasks.push({ id: 2, k: 'k2', lieu: 'Piscine Alpha', start: '08:30', end: '10:00', hrs: 1.5, active: false, odt: 'ODT-77', detail: 'Entretien hebdo',
    notes: 'Pompe bruyante, à surveiller', bassins: [{ bassin: 'Bassin principal', cl: 1.8, ph: 7.4, alc: null, temp: 27 }],
    files: [{ name: 'photo', _local: true }], gps: { lat: 46.81, lng: -71.21, acc: 12 }, sourceLabel: 'WO — Piscine Alpha', approuve: true, approuvePar: 'cwweil' });
  return t;
}
async function open(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => { window.__admin.go('temps'); window.__admin.setState({ tempsTab: 'employe', eUid: 'kael' }); });
  await page.getByText('Pompe bruyante, à surveiller').waitFor();
}

test('par employé : détail complet des punchs (commentaire, mesures, pièces, GPS, lien au travail)', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByText('Chlore libre 1.8 ppm · pH 7.4 · Temp. 27 °C').waitFor();
  await page.getByText(/1 pièce\(s\) : photo — les photos restent sur le téléphone/).waitFor();
  await page.getByText('Lié à : WO — Piscine Alpha').waitFor();
  assert.equal(await page.getByRole('link', { name: 'Position GPS (±12 m)' }).getAttribute('href'), 'https://maps.google.com/?q=46.81,-71.21');
  await page.getByText(/Approuvé par Bureau SA/).waitFor();
  // choisir un autre employé
  await page.getByLabel('Employé').selectOption('kael2');
  await page.getByText('Aucune feuille cette semaine pour cet employé').waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('par employé : imprimer et marquer envoyée seulement pour lui', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Imprimer la feuille' }).click()]);
  await pop.waitForLoadState();
  const txt = await pop.locator('body').innerText();
  assert.match(txt, /Kaël Test/);
  assert.doesNotMatch(txt, /Autre Tech/);
  await pop.close();
  await page.getByRole('button', { name: 'Marquer envoyée à la paie' }).click();
  await toast(page, /1 feuille\(s\) marquée\(s\) envoyée/);
  assert.deepEqual(db.rows('feuilles_temps_envois').map((r) => r.id), ['kael_' + weekKey()]);
  await page.getByText(/Envoyée à la paie le/).waitFor();
  await page.close();
});

test('par employé : corriger un punch et créer un bon de travail assigné depuis un punch', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByRole('button', { name: 'Créer un ODT / bon de travail' }).nth(1).click();
  const dlg = page.locator('.dialog');
  await dlg.getByText('Liste de tâches').waitFor();
  assert.equal(await A(page, () => window.__admin.state.fe.f.client), 'Piscine Alpha');
  assert.deepEqual(await A(page, () => window.__admin.state.fe.f.assignes), ['kael']);
  await dlg.getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Bon de travail créé/);
  assert.ok(db.rows('workorders').some((w) => w.client === 'Piscine Alpha' && w.assigne === 'kael' && w.id !== 'wo-mine'));
  // corriger
  await page.getByRole('button', { name: 'Corriger' }).nth(1).click();
  await dlg.getByText('Corriger le punch').waitFor();
  await dlg.locator('input[type=time]').nth(1).fill('10:30');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Punch corrigé/);
  const t = db.rows('feuilles_temps')[0].days[dayIdx()].tasks.find((x) => x.k === 'k2');
  assert.equal(t.end, '10:30');
  assert.equal(t.notes, 'Pompe bruyante, à surveiller', 'le reste du punch est conservé');
  await page.close();
});

test('par employé : bouton « Hier » va au bon jour (et à la semaine précédente le lundi)', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByRole('button', { name: 'Hier', exact: true }).click();
  const st = await A(page, () => ({ tOff: window.__admin.state.tOff, eDay: window.__admin.state.eDay }));
  const y = new Date(); y.setDate(y.getDate() - 1);
  assert.equal(st.eDay, (y.getDay() + 6) % 7);
  assert.equal(st.tOff, new Date().getDay() === 1 ? -1 : 0);
  await page.getByText(/— hier$/).waitFor();
  await page.close();
});
