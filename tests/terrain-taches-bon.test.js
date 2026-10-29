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
