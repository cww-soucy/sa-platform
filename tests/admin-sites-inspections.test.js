'use strict';
// sa-admin — Sites et inspections : une seule catégorie (une entrée de menu, une barre d'onglets commune, liens croisés).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.clients = [{ id: 'cv', nom: 'Ville X', interne: false, notes: '' }];
  t.sites[0].client_id = 'cv'; t.sites[1].client_id = 'cv';
  t.lieux_alias = [];
  return t;
}

test('une seule entrée « Sites et inspections » et une barre d’onglets commune', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const nav = await page.evaluate(() => window.__admin.vals().navGroups.flatMap((g) => g.items.map((i) => i.label)));
  assert.ok(nav.includes('Sites et inspections'));
  assert.ok(!nav.includes('Inspections') && !nav.includes('Sites'));
  await page.getByRole('button', { name: /Sites et inspections/ }).first().click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'inspections');
  const bar = page.getByRole('tablist', { name: 'Sites et inspections' });
  assert.deepEqual(await bar.getByRole('tab').allTextContents(), ['Inspections et rapports', 'Hivernage', 'Clients et sites', 'Lieux à classer', 'Répertoire']);
  await bar.getByRole('tab', { name: 'Clients et sites' }).click();
  assert.deepEqual(await page.evaluate(() => [window.__admin.state.mod, window.__admin.state.sitesTab]), ['sites', 'clients']);
  assert.equal(await bar.getByRole('tab', { name: 'Clients et sites' }).getAttribute('aria-selected'), 'true');
  await bar.getByRole('tab', { name: 'Répertoire' }).click();
  assert.equal(await page.evaluate(() => window.__admin.state.sitesTab), 'rep');
  // l'entrée du menu reste en surbrillance et rouvre le dernier écran utilisé
  await page.evaluate(() => window.__admin.go('monitoring'));
  await page.getByRole('button', { name: /Sites et inspections/ }).first().click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'sites');
  assert.deepEqual(errors, []);
  await page.close();
});

test('liens croisés : état d’inspection dans la liste des sites, « Fiche du site » depuis l’inspection', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites', { sitesTab: 'clients' }));
  const btn = page.getByRole('button', { name: 'Inspections de Piscine Beta' });
  await btn.waitFor();
  assert.match(await btn.innerText(), /Aucune visite|Visite du/);
  await btn.click();
  assert.deepEqual(await page.evaluate(() => [window.__admin.state.mod, window.__admin.state.inspSite]), ['inspections', '2']);
  await page.getByRole('heading', { name: 'Piscine Beta' }).waitFor();
  await page.getByRole('button', { name: 'Fiche du site' }).click();
  await page.waitForFunction(() => { const v = window.__admin.vals(); return v.sfOpen && v.sfTitle === 'Piscine Beta'; });
  assert.deepEqual(errors, []);
  await page.close();
});

test('inspection : choix du site compact (recherche, clavier, précédent / suivant), liste à gauche en option', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: '1' }));
  // par défaut : pas de colonne, un sélecteur au-dessus de la fiche
  assert.equal(await page.getByRole('button', { name: 'Masquer la liste' }).count(), 0);
  await page.getByText('1 / 3').waitFor();
  await page.getByRole('button', { name: 'Changer de site' }).click();
  const box = page.getByRole('searchbox', { name: 'Chercher un site' });
  await box.waitFor();
  // le curseur est placé juste après l'affichage (setTimeout) : l'attendre plutôt que le lire au même instant
  await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('aria-label') === 'Chercher un site');
  await box.fill('beta');
  await page.getByText('1 site(s) trouvé(s)').waitFor();
  await box.press('Enter');
  await page.getByRole('heading', { name: 'Piscine Beta' }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: 'Choisir un site' }).count(), 0);
  // précédent / suivant dans l'ordre de gravité
  await page.getByRole('button', { name: 'Site suivant' }).click();
  await page.getByRole('button', { name: 'Site précédent' }).click();
  await page.getByRole('heading', { name: 'Piscine Beta' }).waitFor();
  // Échap ferme
  await page.getByRole('button', { name: 'Changer de site' }).click();
  await page.getByRole('searchbox', { name: 'Chercher un site' }).press('Escape');
  assert.equal(await page.getByRole('dialog', { name: 'Choisir un site' }).count(), 0);
  // la liste à gauche reste disponible, gardée sur ce poste
  await page.getByRole('button', { name: 'Afficher la liste à gauche' }).click();
  await page.getByRole('button', { name: 'Masquer la liste' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('sa_admin_insp_liste')), '1');
  assert.deepEqual(errors, []);
  await page.close();
});

test('hivernement depuis Sites et inspections : listes du site, nouvelle liste liée au site, configuration par ouvrage', async () => {
  const t = tables();
  t.sites[1].bassins = [{ id: 'bb1', nom: 'Piscine principale', type: 'piscine' }, { id: 'bb2', nom: 'Jeux d’eau', type: 'jeuxdeau' }];
  t.ouvrage_ajustements = [{ id: 'a1', site_id: '2', bassin_id: 'bb1', domaine: 'hiv', action: 'exclure', ref: 'x', actif: true }];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('sites'));
  await page.getByRole('button', { name: 'Hivernement de Piscine Beta' }).click();
  assert.deepEqual(await page.evaluate(() => [window.__admin.state.mod, window.__admin.state.inspView, String(window.__admin.state.inspSite)]), ['inspections', 'hiver', '2']);
  await page.getByRole('tab', { name: 'Hivernement' }).waitFor();
  // listes du site (rapport existant), configuration par ouvrage
  await page.locator('tr[data-hiv]').first().waitFor();
  assert.equal(await page.locator('tr[data-hiv]').count(), 1);
  assert.match(await page.locator('tr[data-ouvrage="Piscine principale"]').innerText(), /1 étape\(s\) retirée\(s\)/);
  assert.match(await page.locator('tr[data-ouvrage="Jeux d’eau"]').innerText(), /liste complète du gabarit/);
  // configurer un ouvrage : fiche du site ouverte sur « Inspection et hivernage » de cet ouvrage
  await page.locator('tr[data-ouvrage="Jeux d’eau"]').getByRole('button', { name: 'Configurer' }).click();
  await page.waitForFunction(() => { const v = window.__admin.vals(); return v.sfReady && v.ocOpen; });
  assert.equal(await page.evaluate(() => window.__admin.state.oc.i), 1);
  await page.evaluate(() => window.__admin.setState({ oc: null, sf: null }));
  // nouvelle liste : site, ouvrages et étapes déjà choisis
  await page.getByRole('button', { name: 'Nouvel hivernement pour ce site' }).click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.hv);
  const de = await page.evaluate(() => { const d = window.__admin.state.de; return { site: d.hv.info.site, nom: d.f.site_nom, plan: !!d.hv.plan }; });
  assert.deepEqual(de, { site: 'Piscine Beta', nom: 'Piscine Beta', plan: true });
  await page.locator('.dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => /enregistré/.test(window.__admin.state.toast || ''));
  const r = db.rows('rapports_hivernage').find((x) => x.id !== 'hv-old');
  assert.ok(r, 'liste créée (colonnes valides)');
  assert.equal(String(r.site_id), '2');
  await page.waitForFunction(() => document.querySelectorAll('tr[data-hiv]').length === 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('fiche du site : plusieurs courriels acceptés, « Contacts autorisés » ouvre l’accès client du site', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.openSiteFiche(2));
  await page.waitForFunction(() => window.__admin.vals().sfReady);
  const fl = (label) => page.locator('.dialog .field').filter({ has: page.locator('label', { hasText: new RegExp('^' + label.replace(/[()]/g, '\\$&') + '$') }) }).locator('input').first();
  await fl('Courriel(s)').fill('a@client.ca, b@client.ca');
  await page.locator('.dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => /Fiche du site enregistrée/.test(window.__admin.state.toast || ''));
  assert.equal(db.rows('sites').find((s) => String(s.id) === '2').email, 'a@client.ca, b@client.ca');
  await page.evaluate(() => window.__admin.openSiteFiche(2));
  await page.getByRole('button', { name: 'Contacts autorisés (portail client)' }).click();
  assert.deepEqual(await page.evaluate(() => [window.__admin.state.mod, window.__admin.state.inspView, String(window.__admin.state.inspSite)]), ['inspections', 'acces', '2']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('inspections du site : « Nouvel hivernement » à côté de « Nouvelle inspection », hivernements dans l’historique des visites', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: 2, inspView: 'visite' }));
  // l'hivernement existant du site figure dans les visites
  await page.waitForFunction(() => (window.__admin.vals().iq.visites || []).some((v) => v.hiv));
  await page.getByRole('button', { name: /Hivernement/ }).filter({ hasText: 'Kaël Test' }).first().click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.id === 'hv-old');
  await page.evaluate(() => window.__admin.setState({ de: null }));
  // nouvel hivernement depuis l'en-tête du site : enregistré, il rejoint l'historique
  await page.getByRole('button', { name: 'Nouvel hivernement', exact: true }).click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.hv && window.__admin.state.de.hv.info.site === 'Piscine Beta');
  await page.locator('.dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => /enregistré/.test(window.__admin.state.toast || ''));
  assert.equal(String(db.rows('rapports_hivernage').find((x) => x.id !== 'hv-old').site_id), '2');
  await page.waitForFunction(() => window.__admin.vals().iq.visites.filter((v) => v.hiv).length === 2);
  assert.deepEqual(errors, []);
  await page.close();
});

test('visites du site : test d’eau sans connexion (BECSys compris), jamais compté comme brouillon ni comme visite publiée', async () => {
  const t = tables();
  t.releves = (t.releves || []).concat([{ id: 'tl1', site_id: '2', site_nom: 'Piscine Beta', date: new Date().toISOString().slice(0, 10), heure: '09:05', type_code: 'GEN', statut: 'client', source: 'carnet', tech: 'carnet', tech_nom: 'Paul Tremblay',
    vals: { ph: 7.4, cl: 1.6, becsys_mv: 720, becsys_ppm: 1.4, becsys_ph: 7.5 }, touched: { ph: 1, cl: 1 } }]);
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: 2, inspView: 'visite' }));
  await page.waitForFunction(() => (window.__admin.vals().iq.visites || []).some((v) => /BECSys/.test(v.txt)));
  const v = await page.evaluate(() => window.__admin.vals().iq.visites.find((x) => /BECSys/.test(x.txt)));
  assert.equal(v.txt, 'pH 7,4 · Cl 1,6 · BECSys 720 mV / 1,4 ppm / pH 7,5');
  assert.match(v.tech, /Paul Tremblay · test sans connexion/);
  assert.equal(v.brouillon, false);
  assert.equal(await page.evaluate(() => { const s = window.__admin.D.byId[2]; return window.__admin.inspSummary(s).lastV; }), null, 'pas une visite publiée');
  assert.deepEqual(errors, []);
  await page.close();
});
