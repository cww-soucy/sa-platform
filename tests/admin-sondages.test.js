'use strict';
// sa-admin — Sondages clients : clé, liste (ouverts et fermés), création, réutilisation, modification et fermeture ; page sondage qui suit ?slug=.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, FakeDB } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const CLE = 'CW-Soucy-9421-Stats';
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const zone = (page) => page.locator('[data-mod="sondages"]');

function sondagesDb(db) {
  const sond = [
    { slug: 'hivernement-levis-2026', titre: 'Formation hivernement', client: 'Ville de Lévis — Quai Paquet & Anse Benson', actif: true, created_at: '2026-09-22T10:50:00Z' },
    { slug: 'service-dion-2025', titre: 'Service d’entretien', client: 'Dion', actif: false, created_at: '2025-06-01T10:00:00Z' }];
  const rep = [{ sondage_slug: 'hivernement-levis-2026', nom: 'Marc', q2_qualite: 5, q3_clarte: 4, q10_nps: 10, q6_sujets: ['Vidange'], q9_besoins: [], q7_utile: 'Très concret sur le terrain' }];
  const ok = (b) => { if (b.p_cle !== CLE) throw new Error('accès refusé'); };
  db.rpc.sondages_liste = (b) => { ok(b); return sond.slice().sort((a, c) => c.created_at.localeCompare(a.created_at)).map((s) => Object.assign({ reponses: rep.filter((r) => r.sondage_slug === s.slug).length }, s)); };
  db.rpc.sondage_stats = (b) => { ok(b); return rep.filter((r) => r.sondage_slug === b.p_slug); };
  db.appels = [];
  db.rpc.sondage_enregistrer = (b) => { ok(b); db.appels.push(b); let s = sond.find((x) => x.slug === b.p_slug);
    if (!s) { s = { slug: b.p_slug, created_at: new Date().toISOString() }; sond.push(s); } Object.assign(s, { titre: b.p_titre, client: b.p_client, actif: b.p_actif }); return s; };
  return sond;
}

test('sondages : clé, anciens sondages listés, créer, réutiliser, modifier, fermer', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  const sond = sondagesDb(db);
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sondages'));
  await zone(page).getByLabel('Clé d’accès').fill(CLE);
  await zone(page).getByRole('button', { name: 'Valider' }).click();
  // anciens sondages, y compris un sondage fermé
  await zone(page).locator('[data-sondage="service-dion-2025"]').waitFor();
  assert.match(await zone(page).locator('[data-sondage="service-dion-2025"]').innerText(), /Fermé/);
  assert.match(await zone(page).locator('[data-sondage="hivernement-levis-2026"]').innerText(), /1 réponse/);
  await zone(page).getByText('Très concret sur le terrain', { exact: false }).waitFor();
  assert.equal(await zone(page).getByLabel('Lien du sondage').inputValue(), 'https://sa-platform.pages.dev/sondage-hivernement-levis.html?slug=hivernement-levis-2026');

  // créer
  await zone(page).getByRole('button', { name: 'Créer un sondage' }).click();
  await zone(page).getByLabel('Client', { exact: true }).fill('Uashat');
  await zone(page).getByLabel('Site(s) concerné(s)').fill('Piscine municipale');
  await zone(page).getByRole('button', { name: 'Créer le lien' }).click();
  await toast(page, /Sondage créé/);
  const slug = 'formation-hivernement-uashat-' + new Date().getFullYear();
  assert.deepEqual(db.appels.pop(), { p_cle: CLE, p_slug: slug, p_titre: 'Formation hivernement', p_client: 'Uashat — Piscine municipale', p_actif: true });
  await page.waitForFunction((s) => document.querySelector('[aria-label="Lien du sondage"]')?.value.endsWith('?slug=' + s), slug);

  // modifier : le lien (slug) reste le même
  await zone(page).getByRole('button', { name: 'Modifier' }).click();
  assert.equal(await zone(page).getByLabel('Client', { exact: true }).inputValue(), 'Uashat');
  assert.equal(await zone(page).getByLabel('Site(s) concerné(s)').inputValue(), 'Piscine municipale');
  await zone(page).getByLabel('Titre du sondage').fill('Formation hivernement 2026');
  await zone(page).getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Sondage modifié/);
  assert.deepEqual(db.appels.pop(), { p_cle: CLE, p_slug: slug, p_titre: 'Formation hivernement 2026', p_client: 'Uashat — Piscine municipale', p_actif: true });

  // réutiliser l'ancien sondage de Dion pour un autre client : nouveau lien, même titre
  await zone(page).locator('[data-sondage="service-dion-2025"]').click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Lien du sondage"]')?.value.endsWith('=service-dion-2025'));
  await zone(page).getByRole('button', { name: 'Réutiliser pour un autre client' }).click();
  assert.equal(await zone(page).getByLabel('Titre du sondage').inputValue(), 'Service d’entretien');
  await zone(page).getByLabel('Client', { exact: true }).fill('Groupe Mach');
  await zone(page).getByRole('button', { name: 'Créer le lien' }).click();
  await toast(page, /Sondage créé/);
  assert.equal(db.appels.pop().p_slug, 'service-d-entretien-groupe-mach-' + new Date().getFullYear());
  assert.equal(sond.length, 4);
  await page.waitForFunction(() => document.querySelectorAll('[data-sondage]').length === 4);

  // fermer / rouvrir
  await zone(page).locator('[data-sondage="hivernement-levis-2026"]').click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Lien du sondage"]')?.value.endsWith('=hivernement-levis-2026'));
  await zone(page).getByRole('button', { name: 'Fermer le sondage' }).click();
  await toast(page, /Sondage fermé/);
  assert.equal(sond.find((s) => s.slug === 'hivernement-levis-2026').actif, false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sondages : mauvaise clé refusée', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  sondagesDb(db);
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sondages'));
  await zone(page).getByLabel('Clé d’accès').fill('mauvaise');
  await zone(page).getByRole('button', { name: 'Valider' }).click();
  await toast(page, /Clé d’accès incorrecte/);
  await zone(page).getByLabel('Clé d’accès').waitFor();
  assert.deepEqual(errors.filter((e) => !/400/.test(e)), []);
  await page.close();
});

test('page sondage : ?slug= affiche le bon client et enregistre dans ce sondage', async () => {
  const db = new FakeDB({ sondages: [{ slug: 'uashat-2026', titre: 'Formation hivernement', client: 'Uashat', actif: true }], sondage_reponses: [] });
  const page = await browser.newPage();
  await page.route('https://ldqvdiaewvhnukuaxdmc.supabase.co/**', (r) => db.handle(r));
  await page.goto(srv.url + '/sondage-hivernement-levis.html?slug=uashat-2026');
  await page.waitForFunction(() => document.getElementById('sondClient').textContent.includes('Uashat'));
  assert.doesNotMatch(await page.locator('header').innerText(), /Lévis/);
  const fermee = await browser.newPage();
  await fermee.route('https://ldqvdiaewvhnukuaxdmc.supabase.co/**', (r) => db.handle(r));
  await fermee.goto(srv.url + '/sondage-hivernement-levis.html?slug=inconnu');
  await fermee.waitForFunction(() => /fermé/.test(document.getElementById('sondClient').textContent));
  await page.close(); await fermee.close();
});
