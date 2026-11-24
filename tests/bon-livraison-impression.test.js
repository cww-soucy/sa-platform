'use strict';
// Bon de livraison imprimable dans la nouvelle DA (celle de la sortie d'inventaire) : données réelles telles quelles,
// signature du client en image avec le nom et l'heure du Québec, « sans signature » ou lignes à signer selon l'état du bon.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/impression/bon-livraison.js');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const SIG = 'data:image/jpeg;base64,' + 'A'.repeat(1200);
const BON = { no_bon: 'SA-20261123-660', client: 'Club Social de Bien-Être Inc.', adresse: '12 rue des Pins, Lévis', tel: '418 555-0101', technicien: 'Charles-William Weil',
  date: '2026-11-23', heure: '15:30', urgent: true, status: 'livre', livre_at: '2026-11-23T21:06:41Z', livre_par_nom: 'Charles-William Weil',
  items_liv: [{ item: 'Chlore liquide 20 L', qteSortie: '4', unite: 'bidon', qteLivree: '4', statut: '' }, { item: '', qteSortie: '' }],
  items_ret: [{ item: 'Bidon vide', qteRecuperee: '2', unite: 'bidon', raison: 'Consigne' }],
  photos: [{ name: 'Photo du site', data: SIG }, { name: 'Signature — Julie Côté', data: SIG, addedAt: '2026-11-23T21:06:41Z' }] };

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

test('contenu tiré du bon : numéro, urgent, date longue, infos, articles livrés et récupérés', () => {
  const h = B.html(BON);
  assert.match(h, /<title>Bon de livraison SA-20261123-660<\/title>/);
  assert.match(h, /Bon de livraison<span class="u">URGENT<\/span><\/div><h1>SA-20261123-660<\/h1><\/div><div class="d">23 novembre 2026 · 15:30<\/div>/);
  assert.match(h, /Client<b>Club Social de Bien-Être Inc\.<\/b>/);
  assert.match(h, /Adresse<b>12 rue des Pins, Lévis<\/b>/);
  assert.match(h, /Téléphone<b>418 555-0101<\/b>/);
  assert.match(h, /Technicien<b>Charles-William Weil<\/b>/);
  assert.match(h, /<td>Chlore liquide 20 L<\/td><td class="q">4<\/td><td class="q">bidon<\/td><td class="q">4<\/td><td><\/td>/);
  assert.equal((h.match(/<tbody>/g) || []).length, 2, 'ligne vide ignorée, deux tableaux');
  assert.match(h, /<h2>Articles récupérés<\/h2>[\s\S]*<td>Bidon vide<\/td><td class="q">2<\/td><td class="q">bidon<\/td><td>Consigne<\/td>/);
  assert.match(h, /<img class="logo" src="data:image\/png/);
  assert.doesNotMatch(h, /undefined|null/);
});

test('livré et signé : signature en image, nom du signataire, heure du Québec ; les autres photos ne sont pas la signature', () => {
  const h = B.html(BON);
  assert.match(h, /<b>Livré<\/b> le 23 novembre 2026 à 16 h 06 par Charles-William Weil/);
  assert.equal((h.match(/alt="Signature du client"/g) || []).length, 1);
  assert.ok(h.includes('<img src="' + SIG + '" alt="Signature du client">'));
  assert.match(h, /Signature du client<b>Julie Côté<\/b><span>23 novembre 2026 à 16 h 06<\/span>/);
  assert.doesNotMatch(h, /sans signature/);
});

test('livré sans signature, ou pas encore livré : rien d’inventé', () => {
  const sans = B.html(Object.assign({}, BON, { photos: [{ name: 'Signature — X', _stripped: true }] }));
  assert.match(sans, /Livraison validée sans signature du client\./, 'signature sans image : pas d’image vide');
  assert.doesNotMatch(sans, /alt="Signature du client"/);
  const att = B.html({ no_bon: 'SA-20261124-001', client: 'Piscine Beta', status: 'brouillon', items_liv: [], photos: [] });
  assert.match(att, /<div class="blanc"><div>Signature du client<\/div><div>Date<\/div><\/div>/);
  assert.match(att, /Aucun article\./);
  assert.doesNotMatch(att, /Livré|URGENT|Articles récupérés/);
  assert.match(att, /<div class="d"><\/div>/, 'pas de date inventée');
});

test('sa-admin › Logistique : « Imprimer » un bon ouvre le nouveau document, signature comprise', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' },
    tables: Object.assign(base(), { bons_livraison: [Object.assign({ id: 'bl-1', created_by: 'cwweil' }, BON)] }) });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('logistique'));
  await page.getByRole('row', { name: /SA-20261123-660/ }).getByRole('button', { name: 'Ouvrir' }).click();
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.locator('.dialog').getByRole('button', { name: 'Imprimer' }).click()]);
  await pop.waitForLoadState();
  assert.equal(await pop.locator('.titre h1').innerText(), 'SA-20261123-660');
  assert.equal(await pop.locator('.sigs img').count(), 1);
  assert.match(await pop.locator('.sigs').innerText(), /Julie Côté/);
  await pop.close();
  assert.deepEqual(errors, []);
  await page.close();
});
