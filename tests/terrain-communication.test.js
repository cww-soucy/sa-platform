'use strict';
// sa-terrain — Communications du bureau : bandeau « à lire », lecture, confirmation (une procédure se relit à chaque version).
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
  const c = (o) => Object.assign({ portee: 'interne', statut: 'publie', sections: [], version: 1, confirmation: false, epingle: false, auteur_nom: 'Bureau SA', resume: '' }, o);
  t.communications = [
    c({ id: 'n1', type: 'infolettre', titre: 'L’Hebdo terrain · semaine du 28 sept.', date_pub: '2026-09-28', sections: [{ titre: 'Mot de la semaine', texte: 'Belle semaine à tous !' }, { titre: 'Rappel sécurité', texte: '' }] }),
    c({ id: 'p1', type: 'procedure', titre: 'Manipulation du chlore', reference: 'PR-001', version: 2, confirmation: true, contenu: '1. Gants\n2. Lunettes', date_pub: '2026-09-20' }),
    c({ id: 'i1', type: 'information', titre: 'Fermeture du bureau', contenu: 'Fermé lundi.', date_pub: '2026-09-10' }),
    c({ id: 'x1', type: 'lettre', portee: 'externe', titre: 'Lettre à un client', contenu: '…', date_pub: '2026-09-29' }),
    c({ id: 'd1', type: 'information', statut: 'brouillon', titre: 'Brouillon', contenu: '…', date_pub: '2026-09-30' }),
  ];
  t.communication_lectures = [
    { id: 'i1_kael', comm_id: 'i1', uid: 'kael', emp_nom: 'Kaël Test', version: 1, lu_at: '2026-09-11T12:00:00Z' },
    { id: 'p1_kael', comm_id: 'p1', uid: 'kael', emp_nom: 'Kaël Test', version: 1, lu_at: '2026-09-11T12:00:00Z' }, // version 1 lue, la 2 non
  ];
  return t;
}

test('communications : bandeau à lire, lecture d’une infolettre, procédure à reconfirmer (nouvelle version)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: tables() });
  await ready(page);
  await page.getByRole('button', { name: /2 communications à lire/ }).click();
  const titres = await page.evaluate(() => window.__terrain.vals().commList.map((c) => c.titre + (c.isNew ? ' [' + c.newLbl + ']' : '')));
  assert.deepEqual(titres, ['L’Hebdo terrain · semaine du 28 sept. [Nouveau]', 'Manipulation du chlore [À confirmer]', 'Fermeture du bureau'], 'internes publiées seulement, plus récente en premier');
  // infolettre : ouverte = lue
  await page.getByRole('button', { name: /L’Hebdo terrain/ }).click();
  await page.getByText('Belle semaine à tous !').waitFor();
  assert.equal(await page.getByText('Rappel sécurité').count(), 0, 'section vide masquée');
  await page.getByRole('button', { name: 'Communications' }).first().click();
  // procédure : ouverte ≠ confirmée
  await page.getByRole('button', { name: /Manipulation du chlore/ }).click();
  await page.getByText('Procédure · PR-001 · version 2', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'J’ai lu et compris cette procédure' }).click();
  await page.getByText('Lecture confirmée', { exact: true }).waitFor();
  await page.waitForFunction(() => !(JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]')).length);
  const L = db.rows('communication_lectures');
  assert.equal(L.find((l) => l.id === 'p1_kael').version, 2);
  assert.ok(L.find((l) => l.id === 'n1_kael'));
  assert.equal(L.find((l) => l.id === 'n1_kael').emp_nom, 'Kaël Test');
  assert.equal(await page.evaluate(() => window.__terrain.vals().hasCommUnread), false);
  assert.deepEqual(errors, []);
  await page.close();
});
