'use strict';
// sa-terrain — visite d'inspection par système (passation 3a) : Démarrer · Eau · systèmes · Résumé › Valider et envoyer.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.types_bassin[1].checks = ['Écumoires et préfiltres nettoyés', 'Registre RQEP signé', 'Parois et fond brossés'];
  return t;
}

test('visite : systèmes, mesure prise hors zone, point obligatoire, « Non » avec note, bon de travail urgent', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await page.evaluate(() => window.__terrain.open('wo:wo-mine'));
  // Démarrer : 4 systèmes (eau + les 3 systèmes des points du type MI)
  await page.getByText('0 systèmes sur 4').waitFor();
  for (const n of ['Eau du bassin', 'Circulation et filtration', 'Sécurité et RQEP', 'Structure et surfaces']) await page.getByRole('button', { name: new RegExp('^' + n + ' À faire') }).waitFor();
  await page.getByRole('button', { name: 'Continuer : Eau du bassin' }).click();
  // Eau : pH monté hors zone → « Qu'avez-vous fait ? »
  await page.evaluate(() => { const f = window.__terrain.vals().fields.find((x) => x.key === 'ph'); for (let i = 0; i < 8; i++) window.__terrain.vals().fields.find((x) => x.key === 'ph').plus(); });
  await page.getByText('Qu’avez-vous fait ?').waitFor();
  await page.getByRole('button', { name: 'Chloration choc' }).click();
  await page.getByRole('button', { name: 'Suivant : Circulation et filtration' }).click();
  await page.getByRole('button', { name: 'Tout est conforme' }).click();
  assert.equal(await page.getByRole('button', { name: 'Conforme', pressed: true }).count(), 1);
  await page.getByRole('button', { name: 'Suivant : Sécurité et RQEP' }).click();
  assert.equal(await page.getByRole('button', { name: 'Tout est conforme' }).count(), 0, 'sécurité : réponse point par point');
  await page.getByText('Obligatoire', { exact: true }).waitFor();
  // valider sans répondre : refusé, retour au système à compléter
  await page.evaluate(() => { const t = window.__terrain; t.setStep(t.vals().cur.sid, 'resume'); });
  await page.getByRole('button', { name: '1 point à répondre' }).click();
  await page.getByText('Obligatoire', { exact: true }).waitFor();
  await page.getByRole('group', { name: 'Registre RQEP signé' }).getByRole('button', { name: 'Non' }).click();
  await page.evaluate(() => { const t = window.__terrain; t.setStep(t.vals().cur.sid, 'resume'); });
  await page.getByRole('button', { name: 'Valider et envoyer' }).click();
  await page.waitForFunction(() => /« Non » exige une note/.test(window.__terrain.state.toast || ''));
  await page.getByLabel('Note : Registre RQEP signé').fill('Registre absent de la salle');
  await page.getByLabel('Note : Registre RQEP signé').blur();
  await page.getByRole('button', { name: 'Créer un bon de travail urgent' }).click();
  await page.getByRole('button', { name: 'Suivant : Structure et surfaces' }).click();
  await page.getByRole('group', { name: 'Parois et fond brossés' }).getByRole('button', { name: 'À surveiller' }).click();
  await page.getByRole('button', { name: 'Suivant : Résumé' }).click();
  await page.getByText(/^2 actions requises : pH .*, Registre RQEP signé\. À surveiller : Parois et fond brossés\. Circulation et filtration est conforme\.$/).waitFor();
  await page.getByRole('button', { name: 'Valider et envoyer' }).click();
  await page.waitForFunction(() => !window.__terrain._pend && JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length === 0);
  const r = db.rows('releves').find((x) => x.id !== 'r1');
  assert.equal(r.statut, 'publiee');
  assert.equal(r.source, 'terrain');
  assert.deepEqual(r.actions, { ph: 'Chloration choc' });
  assert.deepEqual(Object.fromEntries(Object.entries(r.points).map(([k, v]) => [k, v.etat])), { 'MI-0': 'ok', 'MI-1': 'action', 'MI-2': 'watch' });
  assert.equal(r.points['MI-1'].note, 'Registre absent de la salle');
  assert.match(r.resume, /^2 actions requises/);
  assert.equal(r.checks['Écumoires et préfiltres nettoyés'], true, 'anciennes vérifications toujours remplies (SA Platform)');
  const wo = db.rows('workorders').find((w) => w.id === r.points['MI-1'].wo_id);
  assert.ok(wo, 'bon de travail urgent créé');
  assert.equal(wo.priorite, 'urgent');
  assert.match(wo.descr, /Sécurité et RQEP : Registre RQEP signé — Registre absent/);
  assert.deepEqual(errors, []);
  await page.close();
});
