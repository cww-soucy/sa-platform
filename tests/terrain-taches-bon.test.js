'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function ready(page) { await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt); await page.waitForTimeout(100); }

function tables() {
  const t = base();
  const wo = t.workorders.find((w) => w.id === 'wo-mine');
  wo.descr = 'Entretien hebdo\nVérifier aussi la pompe 2';
  wo.notes = 'Code de la porte : 1234';
  wo.tasks = [{ id: 'a', label: 'Nettoyer le préfiltre', done: false }, { id: 'b', label: 'Changer la sonde pH', done: true }];
  return t;
}

test('fiche : les tâches, la description complète et les notes du bon de travail sont affichées', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ready(page);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  await page.waitForTimeout(100);
  const txt = await page.locator('[data-todo]').innerText();
  assert.match(txt, /À faire sur ce site/);
  assert.match(txt, /Nettoyer le préfiltre/);
  assert.match(txt, /Changer la sonde pH/);
  assert.match(txt, /Vérifier aussi la pompe 2/);
  assert.match(txt, /Code de la porte : 1234/);
  assert.match(txt, /1\/2 fait/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('planning : les tâches du bon de travail sont listées sous la visite', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ready(page);
  await page.evaluate(() => window.__terrain.go('planning'));
  await page.waitForTimeout(100);
  const txt = await page.locator('[data-todo-plan]').first().innerText();
  assert.match(txt, /☐ Nettoyer le préfiltre/);
  assert.match(txt, /☑ Changer la sonde pH/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('fiche sans tâches ni notes : pas de section « À faire » vide', async () => {
  const t = base();
  t.workorders.find((w) => w.id === 'wo-mine').descr = '';
  const { page } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: t });
  await ready(page);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-todo]').count(), 0);
  await page.close();
});

test('fiche : cocher une tâche l’enregistre sur le bon de travail sans écraser ce que le bureau a changé entre-temps', async () => {
  const t = tables();
  t.workorders.find((w) => w.id === 'wo-mine').updated_at = '2026-10-29T08:00:00.000000+00:00';
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: t });
  await ready(page);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  // le bureau ajoute une tâche pendant que le technicien est sur place
  const row = db.rows('workorders').find((w) => w.id === 'wo-mine');
  row.tasks = row.tasks.concat([{ id: 'c', label: 'Ajoutée par le bureau', done: false }]);
  row.updated_at = '2026-10-29T09:00:00.000000+00:00';
  await page.getByRole('checkbox', { name: 'Cocher : Nettoyer le préfiltre' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  const after = db.rows('workorders').find((w) => w.id === 'wo-mine');
  assert.deepEqual(after.tasks.map((x) => [x.id, x.done]), [['a', true], ['b', true], ['c', false]]);
  assert.equal(after.tasks[0].doneBy, 'kael');
  assert.equal(after.notes, 'Code de la porte : 1234');
  assert.match(await page.locator('[data-todo]').innerText(), /2\/2 faits/);
  // décocher
  await page.getByRole('checkbox', { name: 'Décocher : Changer la sonde pH' }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  assert.equal(db.rows('workorders').find((w) => w.id === 'wo-mine').tasks[1].done, false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('hors réseau : la coche reste affichée et part au retour du réseau', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ready(page);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  await page.context().setOffline(true);
  await page.getByRole('checkbox', { name: 'Cocher : Nettoyer le préfiltre' }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Décocher : Nettoyer le préfiltre' }).count(), 1);
  assert.equal(db.rows('workorders').find((w) => w.id === 'wo-mine').tasks[0].done, false);
  // une tournée rechargée pendant que la coche attend ne l'efface pas
  await page.evaluate(() => window.__terrain.jobsFromRows([[{ id: 'wo-mine', client: 'Piscine Alpha', site: '1 rue A, Québec', type: 'entretien', status: 'ouvert', date: window.__terrain.today, assigne: 'kael', tasks: [{ id: 'a', label: 'Nettoyer le préfiltre', done: false }] }], [], []]));
  assert.equal(await page.evaluate(() => window.__terrain.jobs[0].todo.tasks[0].done), true);
  await page.context().setOffline(false);
  await page.evaluate(() => window.__terrain.flush());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  assert.equal(db.rows('workorders').find((w) => w.id === 'wo-mine').tasks[0].done, true);
  assert.deepEqual(errors, []);
  await page.close();
});
