'use strict';
// Planning : chaque travail affiche le type choisi (Entretien, Réparation…) et non « Visite » (12/11/2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, today } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables(d) {
  const t = base();
  t.workorders = [
    { id: 'wo-rep', client: 'Piscine Alpha', site: '1 rue A, Québec', type: 'reparation', priorite: 'normal', status: 'ouvert', date: d, heure_debut: '08:00', assigne: 'kael', descr: '', groupe_id: null },
    { id: 'wo-eau', client: 'Piscine Beta', site: '2 rue B, Lévis', type: 'miseeneau', priorite: 'normal', status: 'ouvert', date: d, heure_debut: '10:00', assigne: 'kael', descr: 'Remplir le bassin', groupe_id: null },
    { id: 'wo-ent', client: 'Piscine Alpha', site: '1 rue A, Québec', type: 'entretien', priorite: 'normal', status: 'ouvert', date: d, heure_debut: '12:00', assigne: 'kael', descr: 'Entretien hebdo', groupe_id: null },
  ];
  t.plan = [{ id: 'p1', client: 'Piscine Beta', addr: '2 rue B, Lévis', site_id: 2, date: d, heure: '14:00', emp: 'kael', type: 'inspection', descr: '', status: 'assigned' }];
  return t;
}

test('sa-admin, Planning équipe : le type choisi s’affiche au lieu de « Visite »', async () => {
  const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables(iso(mon)) });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('planning'));
  await page.waitForFunction(() => (window.__admin.vals().planRows || []).some((r) => r.cells[0].slots.length >= 4));
  const taches = await page.evaluate(() => window.__admin.vals().planRows.find((r) => r.cells[0].slots.length >= 4).cells[0].slots.map((s) => s.tache));
  assert.deepEqual(taches, ['Réparation', 'Mise en eau · Remplir le bassin', 'Entretien hebdo', 'Inspection']);
  assert.ok(!taches.includes('Visite'));
  // 4 semaines / diagramme : libellé lisible (« Réparation », pas « reparation »)
  await page.evaluate(() => window.__admin.setState({ pView: 'mois' }));
  await page.waitForFunction(() => /Piscine Alpha · Réparation/.test(document.body.innerText));
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : la tournée affiche le type du bon (avec accents) quand il n’a pas de description', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: tables(today()) });
  await page.waitForFunction(() => window.__terrain && window.__terrain.jobs && window.__terrain.jobs.length === 4);
  const t = await page.evaluate(() => Object.fromEntries(window.__terrain.jobs.map((j) => [j.id, j.tache])));
  assert.deepEqual(t, { 'wo:wo-rep': 'Réparation', 'wo:wo-eau': 'Mise en eau · Remplir le bassin', 'wo:wo-ent': 'Entretien hebdo', 'pl:p1': 'Inspection' });
  assert.deepEqual(errors, []);
  await page.close();
});
