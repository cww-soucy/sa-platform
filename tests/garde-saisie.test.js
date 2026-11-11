'use strict';
// Garde-saisie (11/11/2026) : une touche ou un clic de travers ne doit plus faire perdre une saisie en cours.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const dlg = (page) => page.locator('.dialog');
const field = (page, label) => dlg(page).locator('.field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label + '$') }) }).locator('input,select,textarea').first();
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const avantDepart = (page) => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
const touche = (page, sel, init) => page.evaluate(([s, i]) => { const el = s ? document.querySelector(s) : document.body; const e = new KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, i)); el.dispatchEvent(e); return e.defaultPrevented; }, [sel, init]);

test('sa-admin : un clic à côté de la fenêtre ne ferme plus une saisie en cours', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  // Fenêtre sans saisie : le clic sur le fond la ferme encore (comportement connu)
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  await field(page, 'Client / site').waitFor();
  assert.equal(await avantDepart(page), false, 'rien de tapé : pas de confirmation au départ');
  await page.mouse.click(5, 5);
  await dlg(page).waitFor({ state: 'detached' });
  // Avec une saisie : le fond ne ferme plus, un avis l'explique
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  await field(page, 'Client / site').fill('Piscine Beta');
  await page.mouse.click(5, 5);
  await page.locator('[data-garde-avis]').getByText(/Saisie non enregistrée/).waitFor();
  assert.equal(await dlg(page).count(), 1, 'la fenêtre reste ouverte');
  assert.equal(await field(page, 'Client / site').inputValue(), 'Piscine Beta');
  // Départ de la page, rechargement, retour arrière : bloqués
  assert.equal(await avantDepart(page), true, 'le navigateur demande confirmation avant de quitter');
  assert.equal(await touche(page, null, { key: 'Backspace' }), true, 'Retour arrière hors d’un champ : sans effet');
  assert.equal(await touche(page, null, { key: 'ArrowLeft', altKey: true }), true, 'Alt+← : sans effet');
  assert.equal(await touche(page, null, { key: 'r', metaKey: true }), true, 'Cmd+R : sans effet');
  assert.equal(await touche(page, '.dialog input', { key: 'Backspace' }), false, 'Retour arrière dans un champ : efface normalement');
  // Annuler ferme normalement ; plus rien à protéger
  await dlg(page).getByRole('button', { name: 'Annuler' }).click();
  await dlg(page).waitFor({ state: 'detached' });
  assert.equal(await avantDepart(page), false);
  assert.equal(await touche(page, null, { key: 'r', metaKey: true }), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : sélection de texte qui finit sur le fond — la fenêtre reste ouverte', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  const f = field(page, 'Client / site');
  await f.waitFor();
  const b = await f.boundingBox();
  await page.mouse.move(b.x + 10, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(await dlg(page).count(), 1, 'appui commencé dans la fenêtre : pas de fermeture');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : page quittée par erreur — la saisie est proposée à la réouverture', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  page.on('dialog', (d) => d.accept());
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  await field(page, 'Client / site').fill('Piscine Beta');
  await dlg(page).getByRole('button', { name: /Kaël Test/ }).click();
  await field(page, 'Heure début').fill('13:00');
  await page.waitForTimeout(400); // copie sur l'appareil
  await page.reload();
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  const offre = page.locator('[data-garde-offre]');
  await offre.getByText(/Saisie non enregistrée retrouvée.*Piscine Beta/).waitFor();
  await offre.getByRole('button', { name: 'Récupérer' }).click();
  assert.equal(await field(page, 'Client / site').inputValue(), 'Piscine Beta');
  assert.equal(await field(page, 'Heure début').inputValue(), '13:00');
  await dlg(page).getByRole('button', { name: 'Créer' }).click();
  await toast(page, /Créneau créé/);
  const p = db.rows('plan')[0];
  assert.equal(p.heure, '13:00');
  // Enregistré : le brouillon est effacé, rien n'est reproposé
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__admin.openFE('plan', null, {}));
  await field(page, 'Client / site').waitFor();
  await page.waitForTimeout(150);
  assert.equal(await offre.count(), 0);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((k) => /_brouillon_/.test(k)).length), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : le geste « retour » ne quitte plus l’app ni une saisie en cours', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: base() });
  await page.waitForFunction(() => window.__terrain);
  const ecran = () => page.evaluate(() => window.__terrain.state.screen);
  // Écran sans saisie : retour → Aujourd'hui (on reste dans l'app)
  await page.evaluate(() => window.__terrain.setState({ screen: 'temps' }));
  await page.goBack();
  await page.waitForFunction(() => window.__terrain.state.screen === 'today');
  // Démarrer un punch avec une saisie : retour → on reste, avec un avis
  await page.evaluate(() => window.__terrain.openPunchForm(null));
  await page.locator('textarea').first().fill('Changer la sonde de chlore');
  await page.goBack();
  await page.waitForFunction(() => /Saisie en cours/.test(window.__terrain.state.toast || ''));
  assert.equal(await ecran(), 'punchform');
  assert.equal(await page.locator('textarea').first().inputValue(), 'Changer la sonde de chlore');
  assert.equal(await avantDepart(page), true);
  // Un deuxième retour : toujours là
  await page.goBack();
  await page.waitForTimeout(100);
  assert.equal(await ecran(), 'punchform');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : app fermée ou rechargée en pleine saisie — tout revient', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: base() });
  page.on('dialog', (d) => d.accept());
  await page.waitForFunction(() => window.__terrain);
  await page.evaluate(() => window.__terrain.openPunchForm(null));
  await page.locator('input[placeholder="Site ou lieu"]').fill('Garage municipal');
  await page.locator('textarea').first().fill('Fuite sous la pompe');
  await page.reload();
  await page.waitForFunction(() => window.__terrain);
  assert.equal(await page.evaluate(() => window.__terrain.state.screen), 'punchform');
  assert.equal(await page.locator('input[placeholder="Site ou lieu"]').inputValue(), 'Garage municipal');
  assert.equal(await page.locator('textarea').first().inputValue(), 'Fuite sous la pompe');
  await page.waitForFunction(() => /Saisie non envoyée retrouvée/.test(window.__terrain.state.toast || ''));
  // Demande en cours de rédaction
  await page.evaluate(() => { window.__terrain.go('demandes'); window.__terrain.setState({ pf: { q: '', lieu: '', siteId: null, odt: '', detail: '', km: '', src: null }, demande: 'mat', demandeTxt: 'Deux bidons de chlore' }); });
  await page.reload();
  await page.waitForFunction(() => window.__terrain);
  assert.equal(await page.evaluate(() => [window.__terrain.state.screen, window.__terrain.state.demande, window.__terrain.state.demandeTxt].join('|')), 'demandes|mat|Deux bidons de chlore');
  // Plus rien en cours : rien n'est gardé
  await page.evaluate(() => window.__terrain.setState({ demande: null, demandeTxt: '' }));
  assert.equal(await page.evaluate(() => localStorage.getItem('sa_terrain_brouillon_kael')), null);
  assert.deepEqual(errors, []);
  await page.close();
});
