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
  await T(page, () => window.__terrain.setState({ hivSel: '10', screen: 'hivForm' }));
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
  // Gabarits : le premier enregistrement copie aussi les gabarits par défaut
  await T(page, () => { window.__admin.setState({ sf: null }); window.__admin.gbOpen('fontaine'); });
  const ta = page.getByLabel('Étapes du gabarit');
  await ta.fill((await ta.inputValue()).replace('## Phase 4 — Protection', '## Phase 4 — Protection\n17. Vérifier le clapet anti-retour !'));
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => (window.__admin.D.gab || []).length === 3);
  const f = db.rows('gabarits_hivernage').find((g) => g.code === 'fontaine');
  assert.deepEqual(db.rows('gabarits_hivernage').map((g) => g.code).sort(), ['fontaine', 'jeuxdeau', 'piscine']);
  assert.deepEqual(f.sections.find((s) => s.id === 'p4').items[0], { n: '17', t: 'Vérifier le clapet anti-retour', crit: true });
  assert.deepEqual(errors, []);
  await page.close();
});
