'use strict';
// Signature discrète du créateur « By Central+ · CW » : écrans de connexion, profil (sa-terrain), menu (sa-admin), portail client.
// Elle ne déplace aucun bouton existant.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, openPlatform, launch } = require('./harness');
const { base } = require('./fixtures');

const TXT = 'By Central+ · CW', TITRE = 'Créé par Charles-William Weil (Central+)';
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function sig(page, scope) {
  const el = page.locator(scope).getByText(TXT, { exact: true });
  await el.waitFor();
  assert.equal(await el.getAttribute('title'), TITRE);
  assert.equal(await el.evaluate((e) => !!e.closest('a,button')), false, 'non cliquable');
  return el;
}
// position du bouton avec et sans la signature : identique
async function nePasDeplacer(page, bouton, retirer) {
  const avant = await page.locator(bouton).boundingBox();
  await page.evaluate(retirer);
  const apres = await page.locator(bouton).boundingBox();
  assert.deepEqual(avant, apres, 'la signature ne déplace pas ' + bouton);
}

test('sa-terrain : sous la connexion et en bas du Profil', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: null, tables: base() });
  await sig(page, '#login');
  await nePasDeplacer(page, '#loginForm button[type=submit]', () => document.querySelector('#login .sa-sig').remove());
  await page.close();
  const o = await openApp(browser, srv.url, { app: 'terrain', user: { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain' }, tables: base() });
  await o.page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await o.page.evaluate(() => window.__terrain.go('profil'));
  const el = await sig(o.page, '#app');
  const deco = await o.page.getByRole('button', { name: 'Se déconnecter' }).boundingBox(), b = await el.boundingBox();
  assert.ok(b.y >= deco.y + deco.height, 'sous « Se déconnecter »');
  assert.deepEqual(errors.concat(o.errors), []);
  await o.page.close();
});

test('sa-admin : sous la connexion et en bas du menu de gauche, sous le nom', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: null, tables: base() });
  await sig(page, '#login');
  await nePasDeplacer(page, '#loginForm button[type=submit]', () => document.querySelector('#login .sa-sig').remove());
  await page.close();
  const o = await openApp(browser, srv.url, { app: 'admin', user: { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' }, tables: base() });
  await o.page.waitForFunction(() => window.__admin && window.__admin.D);
  const el = await sig(o.page, '#app');
  const nom = await o.page.locator('#app').getByText('Bureau SA', { exact: true }).first().boundingBox(), b = await el.boundingBox();
  assert.ok(b.y > nom.y, 'sous le nom de l’utilisateur');
  assert.deepEqual(o.errors, []);
  await o.page.close();
});

test('SA Platform : sous l’écran de connexion, à la place de l’ancienne signature, même hauteur', async () => {
  const { page, errors } = await openPlatform(browser, srv.url, { tables: base() });
  await sig(page, '#screenLogin');
  await nePasDeplacer(page, '#loginBtn', () => { const s = document.querySelector('.login-sig'); s.innerHTML = '<p>Made by</p><span>CWW · Central+</span>'; s.style.padding = '0'; });
  assert.deepEqual(errors, []);
  await page.close();
});

test('portail client : en pied de page', async () => {
  const page = await browser.newPage();
  await page.route('https://ldqvdiaewvhnukuaxdmc.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
  await page.goto(srv.url + '/portail/');
  await sig(page, 'body');
  await page.close();
});
