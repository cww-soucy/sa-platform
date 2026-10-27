'use strict';
// Inspection et hivernage par ouvrage : gabarit d'hivernage selon le type de bassin, ajustements d'un site (ouvrage_ajustements)
// faits par le technicien dans sa-terrain et vus / annulés par le bureau dans sa-admin, gabarits modifiables dans sa-admin.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const T = (page, fn, arg) => page.evaluate(fn, arg);
const text = (page) => page.locator('#app').innerText();
const noQueue = (page) => page.waitForFunction(() => !window.__terrain._pend && !JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length);

/* Place des Canotiers (jeux d'eau) et Cité M (piscine + fontaine) ; le technicien a son punch à Canotiers */
function tables() {
  const t = base();
  t.types_bassin.push({ code: 'JE', label: 'Jeux d’eau', court: 'Jeux d’eau', norme: '', fields: [], checks: ['Grilles de drain dégagées', 'Aucune pièce saillante ou brisée'], produits: [] });
  t.sites.push({ id: 10, nom: 'Place des Canotiers', addr: '95 rue Dalhousie, Québec', notes: '', bassins: [{ id: 'bc1', nom: 'Bassin d’équilibre', type: 'jeuxdeau', type_code: 'JE' }] },
    { id: 11, nom: 'Cité M', addr: '', notes: '', bassins: [{ id: 'bm1', nom: 'Bassin principal', type: 'piscine', type_code: 'GEN' }, { id: 'bm2', nom: 'Fontaine', type: 'autre', type_code: '' }] });
  t.contrats.push({ site_id: 10, type_code: 'JE', code: 'C-010' }, { site_id: 11, type_code: 'GEN', code: 'C-011' });
  t.workorders[0].client = 'Place des Canotiers'; t.workorders[0].site = '95 rue Dalhousie, Québec';
  t.ouvrage_ajustements = [];
  return t;
}

test('sa-terrain : la liste d’hivernage suit les ouvrages, le technicien retire, ajoute et remet des étapes pour le site', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await T(page, () => window.__terrain.setState({ hivSel: '10', screen: 'hivForm', hivVue: { mode: 'detail', texte: 'complet', ordre: 'toutes' } }));
  assert.match(await text(page), /0 cases sur 38/, 'gabarit Jeux d’eau');
  assert.match(await text(page), /Phase 3 — Purge des conduites/);
  assert.doesNotMatch(await text(page), /16 po sous les retours/);
  await page.getByRole('button', { name: /^1\. Mettre le contrôleur des jeux/ }).click();
  await page.getByRole('button', { name: 'Modifier la liste pour ce site' }).click();
  await page.getByRole('button', { name: /Retirer pour ce site : 8\. Retirer la lampe UV/ }).click();
  await page.getByLabel('Ajouter une étape : 4. Phase 2 — Vidange').fill('Vider la cuve de rétention');
  await page.getByRole('button', { name: 'Ajouter l’étape : 4. Phase 2 — Vidange' }).click();
  await noQueue(page);
  let rows = db.rows('ouvrage_ajustements');
  assert.deepEqual(rows.map((r) => [r.site_id, r.bassin_id, r.domaine, r.action, r.ref || r.texte, r.par_nom]),
    [['10', 'bc1', 'hiv', 'exclure', 'jeuxdeau:p2-3', 'Kaël Test'], ['10', 'bc1', 'hiv', 'ajouter', 'Vider la cuve de rétention', 'Kaël Test']]);
  assert.equal(rows[1].section, 'p2');
  await page.getByRole('button', { name: 'Terminer les modifications' }).click();
  const t1 = await text(page);
  assert.match(t1, /1 cases sur 38/, 'une retirée, une ajoutée, la case cochée reste cochée');
  assert.doesNotMatch(t1, /lampe UV/);
  assert.match(t1, /Vider la cuve de rétention/);
  // Remettre l'étape retirée
  await page.getByRole('button', { name: 'Modifier la liste pour ce site' }).click();
  assert.match(await text(page), /Retirées pour ce site[\s\S]*8\. Retirer la lampe UV[\s\S]*Kaël Test/);
  await page.getByRole('button', { name: 'Remettre' }).click();
  await noQueue(page);
  assert.equal(db.rows('ouvrage_ajustements').find((r) => r.id === rows[0].id).actif, false);
  assert.match(await text(page), /1 cases sur 39/);
  // Cité M : une seule liste, piscine puis fontaine
  await T(page, () => window.__terrain.setState({ hivSel: '11', hivEdit: false }));
  const t2 = await text(page);
  assert.match(t2, /Ouvrages : Bassin principal · Fontaine/);
  assert.match(t2, /Phase 1 — Vidange — Bassin principal[\s\S]*Phase 1 — Arrêt et isolement — Fontaine[\s\S]*Matériel et pièces/);
  assert.equal((t2.match(/Sécurité et préparation/g) || []).length, 1, 'section commune une seule fois');
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : « Ne s’applique pas ici » et point ajouté à l’inspection, gardés pour le site', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt && window.__terrain.jobs.length);
  await T(page, () => { const t = window.__terrain; t.open(t.jobs.find((j) => String(j.site) === '10').id); });
  await page.waitForTimeout(300);
  await T(page, () => { const v = window.__terrain.vals(); v.sysRows.find((x) => /Sécurité/.test(x.nom)).go(); });
  assert.match(await text(page), /Grilles de drain dégagées/);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await page.getByRole('button', { name: /Ne s’applique pas ici/ }).first().click();
  await page.getByLabel('Nouveau point pour ce site').fill('Buses dégagées');
  await page.getByRole('button', { name: 'Ajouter le point' }).click();
  await noQueue(page);
  const r = db.rows('ouvrage_ajustements')[0];
  assert.deepEqual([r.site_id, r.bassin_id, r.domaine, r.action, r.ref], ['10', 'bc1', 'insp', 'exclure', 'JE-0']);
  const p = db.rows('inspection_points').find((x) => x.libelle === 'Buses dégagées');
  assert.ok(p, 'point reçu (colonnes valides)');
  assert.deepEqual([p.bassin_id, p.site_id, p.type_code, p.systeme_code], ['bc1', '10', '_ouvrage', 'securite']);
  const t = await text(page);
  assert.doesNotMatch(t, /Grilles de drain dégagées/);
  assert.match(t, /Buses dégagées/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : le bureau voit les ajustements du technicien sur l’ouvrage et les annule ; gabarits enregistrés', async () => {
  const t = tables();
  t.ouvrage_ajustements = [{ id: 'a1', site_id: '11', bassin_id: 'bm2', domaine: 'hiv', action: 'exclure', ref: 'fontaine:p1-0', actif: true, par: 'kael', par_nom: 'Kaël Test', cree_le: '2026-10-14T15:00:00Z' },
    { id: 'a2', site_id: '11', bassin_id: 'bm2', domaine: 'hiv', action: 'ajouter', section: 'p3', texte: 'Ranger la statue', actif: true, par: 'kael', par_nom: 'Kaël Test', cree_le: '2026-10-14T15:01:00Z' }];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await T(page, () => window.__admin.openSiteFiche('11'));
  await page.getByRole('button', { name: /^Inspection et hivernage/ }).nth(1).click();
  const d = page.locator('.dialog').last();
  assert.match(await d.innerText(), /Fontaine — inspection et hivernage[\s\S]*Automatique \(Fontaine\)/);
  assert.match(await d.innerText(), /1\. Arrêter les pompes[^\n]*\n?[^\n]*Retirée par Kaël Test/);
  assert.match(await d.innerText(), /Ranger la statue[\s\S]*ajoutée par Kaël Test/);
  await d.locator('label').filter({ hasText: '1. Arrêter les pompes' }).locator('input').click();
  await page.waitForFunction(() => (window.__admin.D.adj || []).length === 1);
  assert.equal(db.rows('ouvrage_ajustements').find((r) => r.id === 'a1').actif, false);
  assert.equal(db.rows('ouvrage_ajustements').find((r) => r.id === 'a1').annule_par_nom, 'Bureau SA');
  await d.locator('label').filter({ hasText: '2. Fermer l’appoint d’eau' }).locator('input').click();
  await page.waitForFunction(() => (window.__admin.D.adj || []).length === 2);
  const n = db.rows('ouvrage_ajustements').find((r) => r.ref === 'fontaine:p1-1');
  assert.deepEqual([n.bassin_id, n.action, n.par_nom], ['bm2', 'exclure', 'Bureau SA']);
  await page.getByRole('button', { name: 'Terminé' }).click();
  // Gabarits (formulaire) : le premier enregistrement copie aussi les gabarits par défaut
  await T(page, () => { window.__admin.setState({ sf: null }); window.__admin.gbOpen('fontaine'); });
  const sec = page.getByRole('group', { name: /de la section 6$/ }); // Phase 4 — Protection
  assert.equal(await sec.count(), 3);
  await page.getByRole('button', { name: 'Ajouter une étape à la section 6' }).click();
  const e4 = page.getByRole('group', { name: 'Étape 4 de la section 6' });
  await e4.getByLabel('N°').fill('17');
  await e4.getByLabel('Texte de l’étape').fill('Vérifier le clapet anti-retour');
  await e4.getByLabel('Critique').check();
  await page.getByRole('button', { name: 'Ajouter une étape à la section 6' }).click();
  const e5 = page.getByRole('group', { name: 'Étape 5 de la section 6' });
  await e5.getByLabel('Texte de l’étape').fill('Position de la valve principale');
  await e5.getByLabel('Type de réponse').selectOption('choix');
  assert.equal(await e5.getByLabel('Réponses possibles').inputValue(), 'Oui, Non, N/A', 'réponses proposées');
  await e5.getByLabel('Réponses possibles').fill('Ouverte, Fermée, 50 %');
  // Supprimer la première étape de la section, monter la nouvelle étape 17 d'un rang
  await page.getByRole('group', { name: 'Étape 1 de la section 6' }).getByRole('button', { name: 'Supprimer l’étape' }).click();
  await page.getByRole('group', { name: 'Étape 3 de la section 6' }).getByRole('button', { name: 'Monter l’étape' }).click();
  assert.equal(await page.getByRole('group', { name: 'Étape 2 de la section 6' }).getByLabel('Texte de l’étape').inputValue(), 'Vérifier le clapet anti-retour');
  await page.getByLabel('Titre de la section 6').fill('Phase 4 — Protection contre le gel');
  assert.match(await page.locator('.dialog').last().innerText(), /dont \d+ critique\(s\) et 1 à choix multiple/);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => (window.__admin.D.gab || []).length === 3);
  const f = db.rows('gabarits_hivernage').find((g) => g.code === 'fontaine');
  assert.deepEqual(db.rows('gabarits_hivernage').map((g) => g.code).sort(), ['fontaine', 'jeuxdeau', 'piscine']);
  const p4 = f.sections.find((s) => s.id === 'p4');
  assert.equal(p4.titre, 'Phase 4 — Protection contre le gel');
  assert.deepEqual(p4.items.map((it) => [it.id.length > 2 ? 'nouveau' : it.id, it.n || '', it.t.slice(0, 22), !!it.crit, it.choix || null]),
    [['1', '14', 'Laisser le drain du ba', false, null], ['nouveau', '17', 'Vérifier le clapet ant', true, null], ['2', '15', 'Protéger les éléments ', false, null],
      ['nouveau', '5', 'Position de la valve p', false, ['Ouverte', 'Fermée', '50 %']]]);
  // Les retraits existants visent toujours la même étape (référence par identifiant, pas par position)
  const H = require('../src/hivernage/checklist.js');
  assert.equal(H.libelleRef('fontaine:p4-2', db.rows('gabarits_hivernage')), '15. Protéger les éléments décoratifs (housse, panneaux) contre le gel et la neige');
  // Passer une étape à choix multiple en case à cocher
  await T(page, () => window.__admin.gbOpen('fontaine'));
  await page.getByRole('group', { name: 'Étape 4 de la section 6' }).getByLabel('Type de réponse').selectOption('case');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => !window.__admin.state.gb);
  // (le faux Supabase ajoute une ligne au lieu de fusionner sur « code » : la dernière est l'enregistrement)
  assert.equal(db.rows('gabarits_hivernage').filter((g) => g.code === 'fontaine').pop().sections.find((s) => s.id === 'p4').items[3].choix, undefined);
  assert.deepEqual(errors, []);
  await page.close();
});

test('étape à choix multiple : sa-terrain enregistre la réponse choisie, le rapport et l’impression la montrent', async () => {
  const H = require('../src/hivernage/checklist.js');
  const t = tables();
  const g = JSON.parse(JSON.stringify(H.GABARITS.find((x) => x.code === 'jeuxdeau')));
  g.sections.find((s) => s.id === 'p1').items.push({ id: 'ev', n: '4b', t: 'État de la valve d’appoint', choix: ['Ouverte', 'Fermée'], crit: true });
  t.gabarits_hivernage = H.GABARITS.filter((x) => x.code !== 'jeuxdeau').concat([g]).map((x) => Object.assign({ actif: true }, x));
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await T(page, () => window.__terrain.setState({ hivSel: '10', screen: 'hivForm', hivVue: { mode: 'detail', texte: 'complet', ordre: 'toutes' } }));
  assert.match(await text(page), /0 cases sur 39/);
  const q = page.getByRole('group', { name: /4b\. État de la valve d’appoint/ });
  await q.getByRole('button', { name: 'Fermée' }).click();
  assert.equal(await q.getByRole('button', { name: 'Fermée' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await q.getByRole('button', { name: 'Ouverte' }).getAttribute('aria-pressed'), 'false');
  assert.match(await text(page), /1 cases sur 39/);
  // « Tout cocher » ne répond pas à la place du technicien
  await page.getByRole('button', { name: 'Tout cocher' }).nth(1).click();
  assert.equal(await q.getByRole('button', { name: 'Fermée' }).getAttribute('aria-pressed'), 'true');
  // Rapport (SA Platform) et impression
  const plan = H.planSite(t.sites.find((s) => s.id === 10).bassins, t.gabarits_hivernage), k = plan.sections.find((s) => s.sid === 'p1').items.find((it) => it.choix).k;
  const saisie = H.norm({ plan, c: { [k]: 'Fermée' } });
  assert.ok(H.toReport(saisie, {}, []).sections.some((s) => s.items.includes('✔ 4b. État de la valve d’appoint : Fermée')));
  assert.match(H.html(saisie), /État de la valve d’appoint — <strong>Fermée<\/strong> <span class="choix">\(Ouverte \/ Fermée\)/);
  assert.deepEqual(H.critiquesManquants(saisie).filter((x) => /État de la valve/.test(x)), []);
  assert.deepEqual(errors, []);
  await page.close();
});
