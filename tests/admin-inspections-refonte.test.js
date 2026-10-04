'use strict';
// sa-admin › Inspections (refonte) : bilan par système, rapport de visite, saisie bureau, catalogue des points,
// bassins et plan, accès client (fonction serveur « portail » simulée ; sa logique est testée dans portail-fonction.test.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const FN = 'https://ldqvdiaewvhnukuaxdmc.supabase.co/functions/v1/portail';
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
function tables() {
  const t = base();
  t.types_bassin[1].checks = ['Écumoires et préfiltres nettoyés', 'Registre RQEP signé'];
  const d = (n) => iso(addDays(new Date(), -n));
  t.releves = [
    { id: 'r0', site_id: 1, site_nom: 'Piscine Alpha', tech: 'kael', tech_nom: 'Kaël Test', date: d(8), heure: '09:00', type_code: 'MI', vals: { ph: 7.4, cl: 2 }, touched: { ph: 1, cl: 1 }, checks: {}, prods: {}, hors_zone: 0, statut: 'publiee', points: { 'MI-0': { etat: 'ok' }, 'MI-1': { etat: 'watch', note: 'Registre incomplet' } } },
    { id: 'r1', site_id: 1, site_nom: 'Piscine Alpha', tech: 'kael', tech_nom: 'Kaël Test', date: d(1), heure: '10:00', type_code: 'MI', vals: { ph: 7.9, cl: 2 }, touched: { ph: 1, cl: 1 }, checks: {}, prods: { 'Hypochlorite 12 %': 4 }, hors_zone: 1, statut: 'publiee', points: { 'MI-0': { etat: 'ok' }, 'MI-1': { etat: 'action', note: 'Registre absent' } } },
    { id: 'r2', site_id: 2, site_nom: 'Piscine Beta', tech: 'kael', tech_nom: 'Kaël Test', date: d(1), heure: '11:00', type_code: 'GEN', vals: { ph: 7.4, cl: 2 }, touched: { ph: 1, cl: 1 }, checks: {}, prods: {}, hors_zone: 0 },
  ];
  return t;
}
async function open(page, view) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate((v) => window.__admin.go('inspections', { inspSite: '1', inspView: v }), view || 'bilan');
}

test('bilan : sites triés par gravité, verdict, 6 systèmes, « À faire » → bon de travail', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByText('2 actions requises, 0 point à surveiller, 2 points conformes.').waitFor();
  const v = await page.evaluate(() => { const q = window.__admin.vals().iq; return { sites: q.sites.map((s) => s.nom), cards: q.cards.map((c) => c.nom + ':' + c.lib), todo: q.todo.map((t) => t.libelle) }; });
  assert.equal(v.sites[0], 'Piscine Alpha', 'le site avec des actions requises en tête');
  assert.deepEqual(v.cards, ['Eau du bassin:Action requise', 'Traitement et dosage:Sans objet', 'Circulation et filtration:Conforme', 'Chauffage et ventilation:Sans objet', 'Sécurité et RQEP:Action requise', 'Structure et surfaces:Sans objet']);
  assert.deepEqual(v.todo, ['pH', 'Registre RQEP signé']);
  await page.getByRole('row', { name: /Registre RQEP signé/ }).getByRole('button', { name: 'Créer un bon de travail' }).click();
  await toast(page, /Bon de travail créé/);
  const wo = db.rows('workorders').find((w) => /^wo-insp-r1-MI-1/.test(w.id));
  assert.ok(wo);
  assert.equal(wo.priorite, 'urgent');
  assert.equal(db.rows('releves').find((r) => r.id === 'r1').points['MI-1'].wo_id, wo.id);
  assert.deepEqual(errors, []);
  await page.close();
});

test('rapport de visite : sections triées par gravité, étiquettes, PDF client', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page, 'visite');
  await page.getByRole('heading', { name: /^Visite du / }).waitFor();
  const v = await page.evaluate(() => window.__admin.vals().iq.v);
  assert.deepEqual(v.sections.map((s) => s.nom), ['Eau du bassin', 'Sécurité et RQEP', 'Circulation et filtration']);
  assert.equal(v.sections[1].rows[0].tag, 'Depuis le ' + (await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 8); return d.getDate(); })) + ' ' + ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][new Date(Date.now() - 8 * 864e5).getMonth()] + ' ' + new Date(Date.now() - 8 * 864e5).getFullYear());
  assert.equal(v.sections[0].rows[0].tag, 'Nouveau');
  assert.match(v.sections[0].more, /1 autre paramètre dans la zone/);
  assert.deepEqual(v.prods, [{ nom: 'Hypochlorite 12 %', q: '4,00' }]);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'PDF' }).click()]);
  await pop.waitForLoadState();
  assert.match(await pop.locator('body').innerText(), /Intervention en cours : pH et Registre RQEP signé/);
  await pop.close();
  assert.deepEqual(errors, []);
  await page.close();
});

test('saisie bureau : brouillon puis publication, journalisée (source, saisi par), points obligatoires', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page);
  await page.getByRole('button', { name: 'Nouvelle inspection' }).first().click();
  await page.getByLabel('pH', { exact: true }).fill('7,3');
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await toast(page, /Brouillon enregistré/);
  let r = db.rows('releves').find((x) => x.source === 'bureau');
  assert.equal(r.statut, 'brouillon');
  await page.getByRole('button', { name: 'Reprendre le brouillon' }).click();
  await page.getByRole('button', { name: 'Valider et publier' }).click();
  await toast(page, /1 point\(s\) obligatoire\(s\) à répondre : Registre RQEP signé/);
  await page.getByRole('group', { name: 'Registre RQEP signé' }).getByRole('button', { name: 'Oui' }).click();
  await page.getByRole('button', { name: 'Tout conforme' }).click();
  await page.getByRole('button', { name: 'Valider et publier' }).click();
  await toast(page, /Visite publiée/);
  const all = db.rows('releves').filter((x) => x.source === 'bureau');
  assert.equal(all.length, 1, 'le brouillon est publié, pas dupliqué');
  r = all[0];
  assert.equal(r.statut, 'publiee');
  assert.equal(r.saisi_par, 'cwweil');
  assert.equal(r.source_detail, 'telephone');
  assert.deepEqual(r.vals, { ph: 7.3 });
  assert.deepEqual(r.points, { 'MI-0': { etat: 'ok' }, 'MI-1': { etat: 'ok' } });
  assert.ok(db.rows('audit_log').some((a) => a.table_name === 'releves' || JSON.stringify(a).includes(r.id)), 'saisie journalisée');
  assert.deepEqual(errors, []);
  await page.close();
});

test('points de contrôle : la 1re modification enregistre les points du type au catalogue', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page, 'points');
  await page.getByLabel('Système : Écumoires et préfiltres nettoyés').selectOption('dosage');
  await toast(page, /Point enregistré/);
  const cat = db.rows('inspection_points');
  assert.deepEqual(cat.map((p) => [p.id, p.systeme_code]).sort(), [['MI-0', 'dosage'], ['MI-1', 'securite']]);
  await page.getByLabel('Nouveau point de contrôle').fill('Échangeur de chaleur vérifié');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await toast(page, /Chauffage et ventilation/);
  assert.equal(db.rows('inspection_points').length, 3);
  await page.close();
});

test('bassins : ajout d’un bassin dans la fiche du site', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page, 'bassins');
  await page.getByLabel('Nom du nouveau bassin').fill('Pataugeoire');
  await page.getByLabel('Volume du nouveau bassin').fill('40');
  await page.getByRole('button', { name: 'Ajouter le bassin' }).click();
  await toast(page, /Bassin ajouté/);
  const b = db.rows('sites').find((s) => String(s.id) === '1').bassins;
  assert.equal(b.length, 1);
  assert.equal(b[0].nom, 'Pataugeoire');
  assert.equal(b[0].volume, '40');
  await page.close();
});

test('accès client : session de gestion, compte client, contact, code QR, journal', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  const S = { comptes: [], contacts: [], qr: [], journal: [{ quand: new Date().toISOString(), contact_id: null, identifiant: 'x•••@y.ca', qr_id: null, compte_id: null, action: 'code', resultat: 'refuse' }], documents: [] }, calls = [];
  await page.route(FN, async (route) => {
    const b = JSON.parse(route.request().postData()), ok = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    calls.push(b.action);
    if (b.action === 'admin_ouvrir') return ok(b.mdp === 'bon' ? { ok: true, session: 'ADM-TOKEN-xxxxxxxxxxxxxxxx', role: 'admin' } : { ok: false, message: 'Identifiant ou mot de passe incorrect, ou rôle insuffisant.' });
    assert.equal(route.request().headers()['x-portail-session'], 'ADM-TOKEN-xxxxxxxxxxxxxxxx');
    if (b.action === 'admin_lire') return ok({ ok: true, role: 'admin', ...S, portail: 'https://sa-platform.pages.dev/portail/', envoi: false });
    if (b.action === 'admin_ecrire') { const L = S[{ client_comptes: 'comptes', client_contacts: 'contacts', documents: 'documents' }[b.table]]; const i = L.findIndex((x) => x.id === b.row.id); if (i >= 0) L[i] = b.row; else L.push(b.row); return ok({ ok: true }); }
    if (b.action === 'admin_qr') { const q = { id: 'qr1', site_id: b.site_id, bassin_id: b.bassin_id, jeton: 'JETON-ALEATOIRE', code_affiche: b.code_affiche, actif: true, cree_le: new Date().toISOString() }; S.qr.push(q); return ok({ ok: true, qr: q }); }
    return ok({ ok: false });
  });
  await open(page, 'acces');
  await page.getByLabel('Mot de passe').fill('mauvais');
  await page.getByRole('button', { name: 'Ouvrir la gestion' }).click();
  await page.getByText('Identifiant ou mot de passe incorrect').waitFor();
  await page.getByLabel('Mot de passe').fill('bon');
  await page.getByRole('button', { name: 'Ouvrir la gestion' }).click();
  await page.getByText('aucun fournisseur de courriel configuré', { exact: false }).waitFor();
  await page.getByPlaceholder('ex. Ville de Granby').fill('Ville de Test');
  await page.getByRole('button', { name: 'Créer le compte client' }).click();
  await toast(page, /Compte client créé/);
  assert.equal(S.comptes[0].nom, 'Ville de Test');
  assert.deepEqual(S.comptes[0].sites, ['1']);
  await page.getByLabel('Nom du contact').fill('Jeanne Gestion');
  await page.getByLabel('Courriel du contact').fill('jeanne@ville.qc.ca');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await toast(page, /Contact autorisé/);
  assert.equal(S.contacts[0].niveau, 'gestionnaire');
  await page.getByRole('button', { name: 'Créer le code' }).click();
  await page.getByRole('img', { name: /Code QR SA-/ }).waitFor();
  await page.getByLabel('Historique — Opérateur').check();
  await page.waitForFunction(() => true);
  await page.waitForTimeout(200);
  assert.equal(S.comptes[0].niveaux.operateur.historique, true);
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('sa_portail_admin')).t), 'session de gestion retenue pour l’aperçu client');
  assert.deepEqual(errors, []);
  await page.close();
});

test('accès client : code QR créé sans compte client, rôle superviseur', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: { ...USER, role: 'superviseur' }, tables: tables() });
  const S = { comptes: [], contacts: [], qr: [], journal: [], documents: [] };
  await page.route(FN, async (route) => {
    const b = JSON.parse(route.request().postData()), ok = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'admin_ouvrir') return ok({ ok: true, session: 'ADM-TOKEN-xxxxxxxxxxxxxxxx', role: 'superviseur' });
    if (b.action === 'admin_lire') return ok({ ok: true, role: 'superviseur', ...S, portail: 'https://sa-platform.pages.dev/portail/', envoi: true });
    if (b.action === 'admin_qr') { const q = { id: 'qr1', site_id: b.site_id, bassin_id: b.bassin_id, jeton: 'JETON-ALEATOIRE', code_affiche: b.code_affiche, actif: true, cree_le: new Date().toISOString() }; S.qr.push(q); return ok({ ok: true, qr: q }); }
    return ok({ ok: false });
  });
  await open(page, 'acces');
  await page.getByLabel('Mot de passe').fill('bon');
  await page.getByRole('button', { name: 'Ouvrir la gestion' }).click();
  await page.getByText('Envoi des codes par courriel : actif.').waitFor();
  assert.doesNotMatch(await page.textContent('main'), /lecture seule/i);
  await page.getByRole('button', { name: 'Créer le code' }).click();
  await page.getByRole('img', { name: /Code QR SA-/ }).waitFor();
  assert.equal(S.comptes.length, 0, 'aucun compte client requis pour le code QR');
  assert.deepEqual(errors, []);
  await page.close();
});

test('onglets personnalisables : masquer et réordonner, gardé sur le navigateur', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  await open(page, 'bilan');
  const onglets = () => page.getByRole('tablist').first().getByRole('tab').allTextContents();
  assert.deepEqual((await onglets()).slice(0, 2), ['Bilan par système', 'Visites']);
  await page.getByRole('button', { name: 'Personnaliser' }).click();
  await page.getByLabel('Afficher l’onglet Points de contrôle').uncheck();
  await page.getByRole('button', { name: 'Monter Nouvelle inspection' }).click();
  await page.getByRole('button', { name: 'Terminé' }).click();
  const t = await onglets();
  assert.ok(!t.includes('Points de contrôle'));
  assert.ok(t.indexOf('Nouvelle inspection') < t.indexOf('Tendances de l’eau'));
  const pref = await page.evaluate(() => JSON.parse(localStorage.getItem('sa_admin_insp_onglets')));
  assert.deepEqual(pref.cache, ['points']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('accès client : courriel déjà autorisé pour un autre compte → message clair, rien n’est écrit', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: tables() });
  const S = { comptes: [{ id: 'cl-a', nom: 'Ville de Test', sites: ['1'], niveaux: {} }, { id: 'cl-b', nom: 'Autre client', sites: ['2'], niveaux: {} }],
    contacts: [{ id: 'ct-1', compte_id: 'cl-b', nom: 'Jeanne', courriel: 'jeanne@ville.qc.ca', niveau: 'gestionnaire', actif: true }], qr: [], journal: [], documents: [] }, writes = [];
  await page.route(FN, async (route) => {
    const b = JSON.parse(route.request().postData()), ok = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'admin_ouvrir') return ok({ ok: true, session: 'ADM-TOKEN-xxxxxxxxxxxxxxxx', role: 'admin' });
    if (b.action === 'admin_lire') return ok({ ok: true, role: 'admin', ...S, portail: 'https://sa-platform.pages.dev/portail/', envoi: true });
    if (b.action === 'admin_ecrire') { writes.push(b); return ok({ ok: false, message: 'duplicate key value violates unique constraint "client_contacts_courriel"' }); }
    return ok({ ok: false });
  });
  await open(page, 'acces');
  await page.getByLabel('Mot de passe').fill('bon');
  await page.getByRole('button', { name: 'Ouvrir la gestion' }).click();
  await page.getByLabel('Nom du contact').fill('Jeanne G.');
  await page.getByLabel('Courriel du contact').fill('Jeanne@Ville.qc.ca');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await toast(page, /déjà autorisé pour le compte « Autre client »/);
  assert.equal(writes.length, 0);
  assert.deepEqual(errors, []);
  await page.close();
});
