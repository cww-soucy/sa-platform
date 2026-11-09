'use strict';
// sa-terrain — validation du punch à la fermeture / changement de site (2026-11-09) :
//  • site avec des tâches demandées non faites → avertissement + « Terminer quand même » (forcé) ;
//    le punch fermé est forceValide + à valider (le superviseur le voit).
//  • site sans tâche manquante → le punch se ferme auto-validé.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function ready(page) {
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt && Array.isArray(window.__terrain.jobs));
  await page.waitForTimeout(100);
}
function tablesAvecTache() {
  const t = base();
  const wo = t.workorders.find((w) => w.id === 'wo-mine'); // assigné à kael, site 1
  wo.tasks = [{ id: 'a', label: 'Nettoyer le préfiltre', done: false }];
  return t;
}
const tasksDeSite = (page, siteId) => page.evaluate((sid) => {
  const d = window.__terrain.viewDays(), i = (new Date().getDay() + 6) % 7;
  return (d[i].tasks || []).map((t) => ({ lieu: t.lieu, siteId: t.siteId, active: !!t.active, force: !!t.forceValide, pend: !!t.pendingValidation, auto: !!t.autoValide }));
}, siteId);

test('changement de site avec tâche non faite : avertit, puis « terminer quand même » force la validation', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tablesAvecTache() });
  await ready(page);
  // punch sur le site 1 (wo-mine, 1 tâche non faite)
  await page.evaluate(() => { const j = window.__terrain.jobs.find((x) => x.id === 'wo:wo-mine'); window.__terrain.openPunchForm(j); window.__terrain.submitPunch(); });
  await page.waitForTimeout(50);
  // tentative de punch sur un autre site → 1re touche : avertissement, aucun nouveau punch
  await page.evaluate(() => { window.__terrain.setState({ pf: { q: '', lieu: 'Autre lieu', siteId: null, odt: '', detail: '', km: '', src: null } }); window.__terrain.submitPunch(); });
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.__terrain.state.pfForce), true, 'averti (pfForce)');
  assert.equal((await tasksDeSite(page)).filter((t) => t.active).length, 1, 'toujours un seul punch actif');
  // 2e touche : terminer quand même
  await page.evaluate(() => window.__terrain.submitPunch());
  await page.waitForTimeout(50);
  const ts = await tasksDeSite(page);
  const site1 = ts.find((t) => String(t.siteId) === '1');
  assert.ok(site1 && !site1.active, 'le punch du site 1 est fermé');
  assert.ok(site1.force && site1.pend, 'fermé forcé → à valider (superviseur informé)');
  assert.ok(ts.some((t) => t.active && t.lieu === 'Autre lieu'), 'nouveau punch démarré');
  assert.deepEqual(errors, []);
  await page.close();
});

test('fin de journée sur un site sans tâche manquante : punch auto-validé', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  // punch libre (lieu tapé, pas de job → aucune tâche exigée)
  await page.evaluate(() => { window.__terrain.setState({ pf: { q: '', lieu: 'Dépôt matériel', siteId: null, odt: '', detail: '', km: '', src: null } }); window.__terrain.submitPunch(); });
  await page.waitForTimeout(50);
  await page.evaluate(() => { window.__terrain.setState({ sf: { km: '' } }); window.__terrain.submitStop(); });
  await page.waitForTimeout(50);
  const ts = await tasksDeSite(page);
  const t = ts.find((x) => x.lieu === 'Dépôt matériel');
  assert.ok(t && !t.active, 'punch fermé');
  assert.ok(t.auto && !t.pend, 'auto-validé, pas « à valider »');
  assert.deepEqual(errors, []);
  await page.close();
});
