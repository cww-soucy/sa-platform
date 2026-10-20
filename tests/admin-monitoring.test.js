'use strict';
// sa-admin — Monitoring : relevés d'hier / 7 jours visibles, salles mécaniques réelles, mur de contrôle grand écran.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, dayIdx, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.feuilles_temps[0].days[dayIdx()].tasks.push({ id: 2, lieu: 'Piscine Alpha', start: '08:30', end: '', hrs: 0, active: true, siteId: 1 });
  t.releves.push({ id: 'r2', site_id: 2, site_nom: 'Piscine Beta', tech: 'kael2', tech_nom: 'Autre Tech', date: iso(addDays(new Date(), -9)), heure: '14:00', type_code: 'GEN', vals: {}, touched: {}, checks: {}, prods: {}, note: null });
  return t;
}

test('monitoring : les relevés d’hier apparaissent (période), salles mécaniques remplies', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByText('Aucun relevé aujourd’hui.').waitFor();
  await page.getByRole('button', { name: 'Hier', exact: true }).click();
  await page.getByText('Relevés hier (1)').waitFor();
  await page.getByRole('row', { name: /Piscine Alpha.*Kaël Test.*2 valeur\(s\).*1 hors zone/ }).waitFor();
  await page.getByRole('button', { name: '7 derniers jours' }).click();
  await page.getByText('Relevés sur 7 jours (1)').waitFor();
  const s = await page.evaluate(() => window.__admin.vals().salles.map((x) => [x.nom, x.etat, x.hasLive]));
  assert.deepEqual(s, [['Piscine Alpha', '1 valeur(s) hors zone', true], ['Piscine Beta', 'Aucun relevé depuis 9 j', false]]);
  await page.getByText('Sur place : Kaël Test depuis 08:30').first().waitFor();
  // clic sur un relevé → Inspections du site
  await page.getByRole('row', { name: /Piscine Alpha.*Kaël Test.*valeur/ }).click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'inspections');
  assert.deepEqual(errors, []);
  await page.close();
});

test('mur de contrôle : grand écran avec indicateurs, salles, équipe et flux', async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByRole('button', { name: /Mur de contrôle/ }).click();
  const wall = page.getByRole('dialog', { name: 'Mur de contrôle' });
  await wall.getByText('Salles mécaniques').waitFor();
  await wall.getByText('Kaël Test', { exact: true }).waitFor();
  await wall.getByText('Sur place : Kaël Test depuis 08:30').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__admin.vals().wallKpis.map((k) => k.l + '=' + k.v)),
    ['En punch=1', 'Relevés aujourd’hui=0', 'Salles hors zone=1', 'Bons de travail du jour=0 / 2', 'Demandes ouvertes=1']);
  await wall.getByRole('button', { name: 'Quitter' }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Mur de contrôle' }).count(), 0);
  await page.close();
});

test('monitoring : préférences par compte — employés affichés, filtre et tri de l’équipe', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const team = () => page.evaluate(() => window.__admin.vals().monTeamRows.map((t) => t.nom));
  // par défaut : techniciens vus récemment, en punch d'abord (l'admin n'apparaît pas)
  assert.deepEqual(await team(), ['Kaël Test']);
  await page.getByRole('button', { name: /Employés affichés \(1 \/ 3\)/ }).click();
  await page.getByRole('button', { name: 'Bureau SA (bureau)' }).click();
  await page.getByRole('button', { name: 'Autre Tech', exact: true }).click();
  assert.deepEqual(await team(), ['Kaël Test', 'Autre Tech', 'Bureau SA']);
  await page.getByRole('combobox', { name: 'Tri de l’équipe' }).selectOption('nom');
  assert.deepEqual(await team(), ['Autre Tech', 'Bureau SA', 'Kaël Test']);
  await page.getByRole('button', { name: 'En punch', exact: true }).click();
  assert.deepEqual(await team(), ['Kaël Test']);
  // gardé pour ce compte (et seulement lui)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sa_admin_mon_cwweil')));
  assert.equal(saved.tShow, 'punch'); assert.equal(saved.tSort, 'nom'); assert.deepEqual(saved.tSel, { cwweil: true, kael2: true });
  await page.reload();
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  assert.deepEqual(await team(), ['Kaël Test']);
  assert.equal(await page.evaluate(() => localStorage.getItem('sa_admin_mon_autre')), null);
  assert.deepEqual(errors, []);
  await page.close();
});

test('monitoring : salles mécaniques — à l’horaire par défaut, alertes, mes salles suivies, toutes', async () => {
  const t = tables();
  t.sites.push({ id: 5, nom: 'Piscine Gamma', addr: '5 rue C, Québec', notes: '' });
  // Gamma a un relevé mais n'est pas à l'horaire ; Beta n'est plus à l'horaire ; Delta (créneau du jour) n'a aucun relevé
  t.releves.push({ id: 'r3', site_id: 5, site_nom: 'Piscine Gamma', tech: 'kael', tech_nom: 'Kaël Test', date: iso(addDays(new Date(), -2)), heure: '09:00', type_code: 'GEN', vals: { ph: 7.4 }, touched: { ph: 1 }, checks: {}, prods: {}, note: null });
  t.sites.push({ id: 6, nom: 'Piscine Delta', addr: '6 rue D, Lévis', notes: '' });
  t.workorders = t.workorders.filter((w) => w.id !== 'wo-other');
  t.plan.push({ id: 'p1', client: 'Piscine Delta', addr: '6 rue D, Lévis', date: iso(new Date()), heure: '13:00', emp: 'kael2', descr: '', type: '', status: '' });
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const salles = () => page.evaluate(() => window.__admin.vals().salles.map((x) => x.nom));
  assert.deepEqual(await salles(), ['Piscine Alpha', 'Piscine Delta']);
  await page.getByText('À l’horaire aujourd’hui : Autre Tech').waitFor();
  await page.getByRole('button', { name: 'Alertes', exact: true }).click();
  assert.deepEqual(await salles(), ['Piscine Alpha', 'Piscine Beta']);
  await page.getByRole('button', { name: 'Toutes', exact: true }).click();
  assert.deepEqual(await salles(), ['Piscine Alpha', 'Piscine Beta', 'Piscine Delta', 'Piscine Gamma']);
  await page.getByRole('button', { name: 'Mes salles suivies' }).click();
  await page.getByText('Aucune salle suivie').waitFor();
  await page.getByRole('button', { name: /Choisir mes salles \(0\)/ }).click();
  await page.getByRole('searchbox', { name: 'Rechercher un site' }).fill('gam');
  await page.getByRole('button', { name: /^Piscine Gamma( — .*)?$/ }).click();
  assert.deepEqual(await salles(), ['Piscine Gamma']);
  // le mur de contrôle suit le même choix
  assert.deepEqual(await page.evaluate(() => window.__admin.vals().wallSalles.map((x) => x.nom)), ['Piscine Gamma']);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sa_admin_mon_cwweil')));
  assert.equal(saved.sMode, 'suivies'); assert.deepEqual(saved.sPins, { 5: true });
  assert.deepEqual(errors, []);
  await page.close();
});

const AUTRE = (valeur) => ({ id: 'cwweil:monitoring', uid: 'cwweil', cle: 'monitoring', valeur, appareil: 'ap-autre', appareil_nom: 'PC Windows · Chrome', updated_at: new Date(Date.now() - 3600e3).toISOString() });

test('réglages du Monitoring : enregistrés au compte (suivent l’utilisateur)', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByText('Réglages liés à votre compte (tous vos appareils)').waitFor();
  await page.getByRole('button', { name: 'En punch', exact: true }).click();
  await page.waitForTimeout(900);
  const w = db.writes('preferences_comptes');
  assert.equal(w.length, 1);
  const dev = await page.evaluate(() => localStorage.getItem('sa_admin_appareil'));
  assert.equal(w[0].body.id, 'cwweil:monitoring'); assert.equal(w[0].body.valeur.tShow, 'punch'); assert.equal(w[0].body.appareil, dev);
  assert.equal(w[0].body.valeur.tCfg, undefined);
  assert.deepEqual(errors, []);
  await page.close();
});

test('nouvel appareil : la question est posée — garder les réglages du compte', async () => {
  const t = tables(); t.preferences_comptes = [AUTRE({ tShow: 'punch', tSort: 'nom', tSel: {}, sMode: 'toutes', sSort: 'nom', sPins: {} })];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const dlg = page.getByRole('dialog', { name: 'Nouvel appareil' });
  await dlg.getByText(/faits sur un autre appareil \(PC Windows · Chrome/).waitFor();
  await dlg.getByRole('button', { name: 'Garder mes réglages' }).click();
  assert.equal(await page.getByRole('dialog', { name: 'Nouvel appareil' }).count(), 0);
  assert.deepEqual(await page.evaluate(() => window.__admin.vals().salles.map((x) => x.nom)), ['Piscine Alpha', 'Piscine Beta']);
  assert.equal(await page.evaluate(() => localStorage.getItem('sa_admin_mon_cwweil_mode')), 'compte');
  // un changement ici part au compte
  await page.getByRole('button', { name: 'Alertes', exact: true }).click();
  await page.waitForTimeout(900);
  assert.equal(db.writes('preferences_comptes').pop().body.valeur.sMode, 'alertes');
  // la question n'est plus reposée sur cet appareil
  await page.reload();
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  assert.equal(await page.evaluate(() => window.__admin.vals().monAsk), false);
  assert.deepEqual(errors, []);
  await page.close();
});

test('nouvel appareil : « Changer pour cet appareil » — réglages propres, le compte ne bouge pas', async () => {
  const t = tables(); t.preferences_comptes = [AUTRE({ tShow: 'tous', tSort: 'statut', tSel: {}, sMode: 'toutes', sSort: 'etat', sPins: {} })];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByRole('dialog', { name: 'Nouvel appareil' }).getByRole('button', { name: 'Changer pour cet appareil' }).click();
  await page.getByText('Réglages propres à cet appareil', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__admin.vals().salles.length), 2); // départ : réglages du compte (« Toutes » : Alpha et Beta)
  await page.getByRole('button', { name: 'Mes salles suivies' }).click();
  await page.waitForTimeout(900);
  assert.equal(db.writes('preferences_comptes').length, 0);
  // revenir aux réglages du compte
  await page.getByRole('button', { name: 'Reprendre les réglages du compte' }).click();
  assert.equal(await page.evaluate(() => window.__admin.monPrefs().sMode), 'toutes');
  assert.deepEqual(errors, []);
  await page.close();
});

test('réglages : sans la table au serveur, ils restent sur l’appareil sans erreur', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables(), fail: { preferences_comptes: 404 } });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.getByText('Réglages gardés sur cet appareil seulement').waitFor();
  await page.getByRole('button', { name: 'Toutes', exact: true }).click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sa_admin_mon_cwweil')).sMode), 'toutes');
  assert.deepEqual(errors, []);
  await page.close();
});

test('demande du terrain « Marquer traitée » : PATCH statut, journal, plus comptée dans « Demandes ouvertes » ni dans l’alerte URGENCE', async () => {
  const t = tables();
  t.demandes.push({ id: 'd2', tech: 'kael2', tech_nom: 'Autre Tech', site_nom: 'Piscine Alpha', type: 'Urgence', motif: 'Fuite', texte: 'Fuite salle mécanique', statut: 'Envoyée', created_at: new Date().toISOString() });
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const kpi = () => page.evaluate(() => { const k = window.__admin.vals().kpis.find((x) => x.label === 'Demandes ouvertes'); return [k.val, k.sub]; });
  await page.evaluate(() => window.__admin.go('globale'));
  await page.getByText('1 demande(s) urgente(s) non traitée(s)').waitFor();
  await page.evaluate(() => window.__admin.go('monitoring'));
  assert.deepEqual(await kpi(), [2, '1 urgence(s)']);
  await page.getByText('Urgence — Fuite salle mécanique').first().waitFor();
  await page.getByRole('button', { name: 'Marquer traitée' }).first().waitFor();
  const avant = await page.getByRole('button', { name: 'Marquer traitée' }).count();
  assert.equal(avant, 2, 'un bouton par demande ouverte du flux');
  // la demande urgente (la plus récente) est en tête du flux
  await page.locator('main').getByText('Urgence — Fuite salle mécanique').locator('xpath=..').getByRole('button', { name: 'Marquer traitée' }).click();
  await page.waitForFunction(() => /Demande marquée traitée/.test(window.__admin.state.toast || ''));
  await page.waitForFunction(() => window.__admin.vals().kpis.find((x) => x.label === 'Demandes ouvertes').val === 1);
  assert.deepEqual(await kpi(), [1, 'du terrain']);
  const w = db.writes('demandes');
  assert.equal(w.length, 1);
  assert.equal(w[0].method, 'PATCH');
  assert.match(w[0].query, /id=eq\.d2/);
  assert.equal(w[0].body.statut, 'Traitée');
  assert.equal(db.rows('demandes').find((d) => d.id === 'd1').statut, 'Envoyée', 'l’autre demande est intacte');
  assert.ok(db.rows('audit_log').some((a) => a.ressource === 'demandes' && a.ressource_id === 'd2'), 'journal d’audit');
  assert.equal(await page.getByRole('button', { name: 'Marquer traitée' }).count(), 1, 'plus de bouton sur la demande traitée');
  await page.evaluate(() => window.__admin.go('globale'));
  await page.waitForTimeout(200);
  assert.doesNotMatch(await page.locator('main').innerText(), /urgente\(s\) non traitée/);
  assert.deepEqual(errors, []);
  await page.close();
});
