'use strict';
// Modules ajoutés à sa-terrain : correction de punch, photo de demande, logistique, hivernage.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, dayIdx } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
// Petite image PNG valide (20×20) pour simuler l'appareil photo
const IMG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAAKklEQVR4nGP8z4AfMBGQHlUwqmBUwaiCUQWjCkYVjCoYVTCqYFTBqAIGAAC0BAHt2UoTZQAAAABJRU5ErkJggg==', 'base64');

let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function ready(page) { await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt); await page.waitForTimeout(100); }
const T = (page, fn, arg) => page.evaluate(fn, arg);
const noQueue = (page) => page.waitForFunction(() => !window.__terrain._pend && !JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length && !window.__terrain.ops().length);
const text = (page) => page.locator('#app').innerText();

test('punch : corriger l’heure de fin depuis le téléphone (protocole SA Platform, soumis au superviseur)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => window.__terrain.go('temps'));
  await page.getByRole('button', { name: /07:00 → 08:00/ }).click();
  assert.match(await text(page), /Corriger un punch/);
  await page.locator('input[type=time]').nth(1).fill('09:00');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await noQueue(page);
  const t = db.rows('feuilles_temps')[0].days[dayIdx()].tasks[0];
  assert.equal(t.end, '09:00');
  assert.equal(t.hrs, 2);
  assert.equal(t.pendingReason, 'correction_employe', 'la correction doit remonter au superviseur');
  assert.ok(t.k && t.k0 === '07:00|Entrepôt' && t.mod > 0, 'identité stable + horodatage de modification');
  assert.deepEqual(errors, []);
  await page.close();
});

test('punch : suppression en deux temps, avec pierre tombale pour la synchro de SA Platform', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => window.__terrain.go('temps'));
  await page.getByRole('button', { name: /07:00 → 08:00/ }).click();
  await page.getByRole('button', { name: 'Supprimer ce punch' }).click();
  assert.equal(db.writes('feuilles_temps').length, 0, 'la première touche demande seulement confirmation');
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await noQueue(page);
  const d = db.rows('feuilles_temps')[0].days[dayIdx()];
  assert.equal(d.tasks.length, 0);
  assert.equal(d.del.length, 1);
  assert.equal(d.del[0].sig, '07:00|Entrepôt');
  await page.close();
});

test('punch : heure invalide refusée, rien n’est envoyé', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => { const t = window.__terrain; t.openPunchEdit(0, { start: '07:00', lieu: 'X', end: '08:00' }); t.setState({ pe: Object.assign({}, t.state.pe, { start: '7h' }) }); t.savePunchEdit(); });
  assert.match(await T(page, () => window.__terrain.state.toast), /Heure de début invalide/);
  assert.equal(db.writes('feuilles_temps').length, 0);
  await page.close();
});

test('demande : photo jointe envoyée avec la demande', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => { window.__terrain.go('demandes'); window.__terrain.vals().demTypes[0].go(); });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Joindre une photo' }).click()]);
  await chooser.setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: IMG });
  await page.getByRole('button', { name: /Photo jointe/ }).waitFor();
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await noQueue(page);
  const d = db.rows('demandes').find((x) => x.tech === 'kael' && x.id !== 'd1');
  assert.match(d.photo, /^data:image\/jpeg;base64,/);
  await page.close();
});

test('logistique : sortie d’inventaire enregistrée au format de SA Platform', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => window.__terrain.vals().goLog());
  await page.waitForFunction(() => window.__terrain.inv.length === 3);
  await page.getByRole('button', { name: 'Plus' }).first().click();
  await page.getByRole('button', { name: 'Plus' }).first().click();
  assert.match(await text(page), /En stock : 10 bidon/);
  await page.getByRole('button', { name: /Enregistrer la sortie · 1 article/ }).click();
  await noQueue(page);
  const s = db.rows('sorties_inventaire')[0];
  assert.ok(s, 'sortie reçue par le serveur (colonnes valides)');
  assert.equal(s.status, 'envoye');
  assert.equal(s.no_employe, 'kael');
  assert.deepEqual(s.lignes.map((l) => [l.desc, l.qteSortie]), [['Chlore liquide 20 L', '2']]);
  assert.deepEqual(errors, []);
  await page.close();
});

async function sign(page) {
  const c = page.locator('canvas');
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 30, b.y + 60); await page.mouse.down();
  await page.mouse.move(b.x + 90, b.y + 90, { steps: 5 }); await page.mouse.move(b.x + 160, b.y + 50, { steps: 5 });
  await page.mouse.up();
}

test('logistique : bon en attente signé par le client → marqué livré sans écraser le reste du bon', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => { window.__terrain.vals().goLog(); window.__terrain.setState({ logTab: 'bon' }); });
  await page.waitForFunction(() => window.__terrain.bons.length === 1);
  assert.match(await text(page), /SA-20260928-111 · Piscine Beta/);
  assert.doesNotMatch(await text(page), /SA-20260901-222/, 'un bon déjà livré n’est pas proposé');
  await page.getByRole('button', { name: /SA-20260928-111/ }).click();
  await page.getByRole('button', { name: 'Confirmer la signature' }).click();
  assert.match(await T(page, () => window.__terrain.state.toast), /nom du signataire/);
  await page.getByPlaceholder('Ex. responsable de la piscine').fill('Julie Côté');
  await page.getByRole('button', { name: 'Confirmer la signature' }).click();
  assert.match(await T(page, () => window.__terrain.state.toast), /Faites signer/);
  await sign(page);
  await page.getByRole('button', { name: 'Confirmer la signature' }).click();
  await page.getByText(/Signé par Julie Côté à \d\d:\d\d — bon marqué livré/).waitFor();
  await noQueue(page);
  const w = db.writes('bons_livraison')[0];
  assert.equal(w.method, 'PATCH', 'mise à jour partielle, jamais la ligne entière');
  assert.match(w.query, /status=neq\.livre/);
  const b = db.rows('bons_livraison').find((x) => x.id === 'bl-a');
  assert.equal(b.status, 'livre');
  assert.equal(b.livre_par_nom, 'Kaël Test');
  assert.equal(b.created_by, 'cwweil', 'champs du bureau intacts');
  assert.equal(b.photos[0].name, 'Signature — Julie Côté');
  assert.match(b.photos[0].data, /^data:image\/jpeg/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('logistique : nouveau bon créé à partir de la sortie, signé et livré', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => window.__terrain.vals().goLog());
  await page.waitForFunction(() => window.__terrain.inv.length === 3);
  await page.getByRole('button', { name: 'Plus' }).nth(2).click();
  await page.getByRole('button', { name: /Enregistrer la sortie/ }).click();
  await T(page, () => window.__terrain.setState({ logTab: 'bon' }));
  await page.getByRole('button', { name: /Nouveau bon depuis la sortie · 1 article/ }).click();
  assert.match(await text(page), /Joint torique 2 po\s*1 u/);
  await page.getByPlaceholder('Ex. responsable de la piscine').fill('Marc Roy');
  await sign(page);
  await page.getByRole('button', { name: 'Confirmer la signature' }).click();
  await noQueue(page);
  const b = db.rows('bons_livraison').find((x) => x.id !== 'bl-a' && x.id !== 'bl-b');
  assert.ok(b, 'bon créé (colonnes valides)');
  assert.equal(b.status, 'livre');
  assert.equal(b.technicien, 'Kaël Test');
  assert.match(b.no_bon, /^SA-\d{8}-\d{3}$/);
  assert.deepEqual(b.items_liv.map((i) => [i.item, i.qteLivree]), [['Joint torique 2 po', '1']]);
  await page.close();
});

test('hivernage : liste réelle des sites, liste de contrôle « Hivernement » envoyée au bureau', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: USER, tables: base() });
  await ready(page);
  await T(page, () => window.__terrain.vals().goHiv());
  await page.waitForFunction(() => Object.keys(window.__terrain.hivRep).length === 1);
  const v = await T(page, () => { const x = window.__terrain.vals(); return { done: x.hivDoneCount, tot: x.hivTotalSites, list: x.hivList.map((h) => h.nom) }; });
  // site 1 = piscine intérieure (MI) exclue, site 3 fusionné exclu, site 2 déjà fait cette année
  assert.deepEqual(v, { done: 1, tot: 2, list: ['Piscine Alpha Sud'] });
  await page.getByRole('button', { name: /Piscine Alpha Sud/ }).click();
  assert.match(await text(page), /0 cases sur 58/);
  await page.getByRole('button', { name: /^1\. Vidanger le bassin au complet/ }).click();
  await page.getByRole('button', { name: /^7\. Installer les bouchons expansibles/ }).click();
  await page.getByRole('button', { name: 'Tout cocher' }).first().click();
  await page.locator('.field').filter({ hasText: 'Température' }).locator('input').fill('6 °C');
  await page.getByRole('button', { name: /Ajouter un employé/ }).click();
  await page.getByLabel('Employé (nom)').fill('Jean Recrue');
  await page.getByRole('button', { name: 'Démonstration réussie' }).click();
  await page.getByPlaceholder('Bris, pièces à commander, remarques').fill('Skimmer fissuré');
  assert.match(await text(page), /9 cases sur 60/);
  await page.getByRole('button', { name: 'Envoyer au bureau' }).click();
  await noQueue(page);
  const r = db.rows('rapports_hivernage').find((x) => x.id !== 'hv-old');
  assert.ok(r, 'rapport reçu (colonnes valides)');
  assert.equal(r.site_nom, 'Piscine Alpha Sud');
  assert.equal(r.site_id, '4');
  assert.equal(r.status, 'brouillon');
  assert.equal(r.technicien, 'Kaël Test');
  assert.equal(r.callout, 'Skimmer fissuré');
  const h = r.sections[0].hivernement;
  assert.equal(h.info.temperature, '6 °C');
  assert.equal(h.c['p1-0'], true);
  assert.equal(h.c['p3-2'], true);
  assert.deepEqual(h.employes, [{ nom: 'Jean Recrue', formation: false, demo: true }]);
  assert.equal(r.sections[0].tag, 'urgent', 'étapes critiques non cochées');
  assert.ok(r.sections.some((x) => x.title === '3. Phase 1 — Vidange' && x.items[0].startsWith('✔ ')), 'lisible par SA Platform');
  await page.waitForFunction(() => window.__terrain.vals().hivDoneCount === 2);
  assert.deepEqual(errors, []);
  await page.close();
});
