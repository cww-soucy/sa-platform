'use strict';
// Sortie d’inventaire imprimable (nouvelle DA, maquette SI-305552, novembre 2026) : données réelles affichées telles quelles,
// date longue, polices locales, tableau qui grandit sur plusieurs pages (en-tête répété, lignes insécables, signatures jamais seules).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const S = require('../src/impression/sortie-inventaire.js');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');
const ROOT = path.join(__dirname, '..');

const SORTIE = { no_bon: 'SA-INV-20261119-574', client: "La Plaza de l'Uniforme", nom: 'Cheikh Ndiaye', no_employe: 'cndiaye', departement: 'Service', date: '2026-11-19',
  lignes: [{ code: 'PH-', loc: 'ENT', desc: 'Bisulfate de sodium', qteSortie: '2', qteRetour: '0', projet: '303552', odt: '303552' }] };
const lignes = (n) => Array.from({ length: n }, (_, i) => ({ code: 'P' + (1000 + i), loc: 'ENT', desc: i === 3 ? 'Antigel biodégradable pour tuyauterie de piscine (non toxique, -50 °C) — bidon 4 L, description très longue' : 'Article ' + i, qteSortie: String(i + 1), qteRetour: '', projet: '303552' }));

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('contenu tiré de la sortie : numéro, date longue, infos, ligne telle quelle', () => {
  const h = S.html(SORTIE);
  assert.match(h, /<title>Sortie d'inventaire SA-INV-20261119-574<\/title>/);
  assert.match(h, /<h1>SA-INV-20261119-574<\/h1><\/div><div class="d">19 novembre 2026<\/div>/);
  assert.match(h, /Client \/ projet<b>La Plaza de l'Uniforme<\/b>/);
  assert.match(h, /ODT<b>303552<\/b>/, 'ODT rangé dans les lignes');
  assert.match(h, /Employé<b>Cheikh Ndiaye \(cndiaye\)<\/b>/);
  assert.match(h, /Département<b>Service<\/b>/);
  assert.match(h, /<td>PH-<\/td><td>ENT<\/td><td>Bisulfate de sodium<\/td><td class="q">2<\/td><td class="q">0<\/td><td>303552<\/td>/, 'code incomplet affiché tel quel');
  assert.match(h, /<th>Code<\/th><th>Emplacement<\/th><th>Description<\/th><th class="q">Qté sortie<\/th><th class="q">Qté retour<\/th><th>Projet \/ client<\/th>/);
  assert.match(h, /Signature de l'employé<\/div><div>Signature du superviseur/);
  assert.match(h, /<img class="logo" src="data:image\/png/);
  assert.doesNotMatch(h, /gradient|box-shadow|filter:/, 'ni dégradé, ni ombre, ni filtre sur le logo');
});

test('champs vides : rien d’inventé', () => {
  const h = S.html({ no_bon: 'SA-INV-20261119-001', nom: 'Kaël Test', date: '', lignes: [{ code: '', desc: 'Pompe', qteSortie: '1' }] });
  assert.match(h, /Client \/ projet<b><\/b>/);
  assert.match(h, /ODT<b><\/b>/);
  assert.match(h, /Employé<b>Kaël Test<\/b>/, 'pas de parenthèses vides');
  assert.match(h, /<div class="d"><\/div>/, 'pas de date inventée');
  assert.match(h, /<td><\/td><td><\/td><td>Pompe<\/td><td class="q">1<\/td><td class="q"><\/td>/);
  assert.doesNotMatch(h, /—|undefined|null/);
});

test('polices locales déclarées et gardées par le service worker', () => {
  const h = S.html(SORTIE), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ['inter-400', 'inter-600', 'barlow-condensed-700'].forEach((f) => {
    assert.ok(h.includes('/fonts/' + f + '.woff2'), f);
    assert.ok(sw.includes("'/fonts/" + f + ".woff2'"), 'sw.js : ' + f);
  });
  assert.match(sw, /CACHE_NAME = 'sa-platform-v86'/);
});

test('plusieurs pages : en-tête répété, lignes insécables, dernière ligne et signatures ensemble', async () => {
  const h = S.html(Object.assign({}, SORTIE, { lignes: lignes(40) }));
  assert.match(h, /thead\{display:table-header-group\}/);
  assert.match(h, /tr\{break-inside:avoid/);
  assert.match(h, /tbody\.fin\{break-inside:avoid/);
  assert.match(h, /<tbody class="fin"><tr><td>P1039<\/td>[\s\S]*Signature du superviseur[\s\S]*<\/tbody><\/table>/);
  assert.match(h, /td\{[^}]*overflow-wrap:anywhere/, 'les longues descriptions passent à la ligne');
  const page = await browser.newPage();
  try {
    await page.goto(srv.url + '/sw.js');
    const pages = async (d) => { await page.setContent(S.html(d)); await page.evaluate(() => document.fonts.ready);
      return ((await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; };
    assert.equal(await pages(SORTIE), 1, '1 ligne : une page');
    assert.ok(await pages(Object.assign({}, SORTIE, { lignes: lignes(40) })) >= 2, '40 lignes : plusieurs pages');
    assert.deepEqual(await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight).sort()),
      ['Barlow Condensed 700', 'Inter 400', 'Inter 600'], 'polices locales chargées');
  } finally { await page.close(); }
});

test('sa-admin › Logistique : « Imprimer » une sortie ouvre le nouveau document', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' },
    tables: Object.assign(base(), { sorties_inventaire: [Object.assign({ id: 'so-1', status: 'envoye' }, SORTIE)] }) });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('logistique'));
  await page.getByRole('button', { name: 'Sorties d’inventaire' }).click();
  await page.getByRole('row', { name: /SA-INV-20261119-574/ }).getByRole('button', { name: 'Ouvrir' }).click();
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.locator('.dialog').getByRole('button', { name: 'Imprimer' }).click()]);
  await pop.waitForLoadState();
  assert.equal(await pop.locator('.titre h1').innerText(), 'SA-INV-20261119-574');
  assert.equal(await pop.locator('.titre .d').innerText(), '19 novembre 2026');
  assert.match(await pop.locator('.infos').innerText(), /303552[\s\S]*Cheikh Ndiaye \(cndiaye\)/);
  await pop.close();
  assert.deepEqual(errors, []);
  await page.close();
});
