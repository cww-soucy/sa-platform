'use strict';
// Hivernement personnalisable : type d'intervention, travaux sur mesure, matériel et produits utilisés, sections propres au site
// (ouvrage_ajustements, section « libre:Titre »), sections de gabarit réservées à certains types ; Hivernage dans « Sites et inspections ».
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/hivernage/checklist.js');
const schema = require('./schema.json');
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

function tables() {
  const t = base();
  t.sites.push({ id: 10, nom: 'Parc Laval', addr: '1 rue A, Québec', notes: '', bassins: [{ id: 'bp1', nom: 'Piscine', type: 'piscine', type_code: 'GEN' }] });
  t.contrats.push({ site_id: 10, type_code: 'GEN', code: 'C-010' });
  t.ouvrage_ajustements = [];
  return t;
}

test('modèle : le type retire la formation, les travaux et le matériel vont au rapport, sections libres et [types:]', () => {
  const d = H.blank({ site: 'Parc Laval', date: '2026-10-27' });
  assert.equal(H.typeDe(d).nom, 'Fermeture avec formation', 'anciens rapports : avec formation');
  assert.ok(H.sectionsDe(d).some((s) => s.id === 'form'));
  d.type = 'complete';
  assert.ok(!H.sectionsDe(d).some((s) => s.id === 'form'), 'fermeture complète : pas de section Formation');
  assert.equal(H.progress(d).total, 51);
  d.travaux.push({ t: 'Remplacer le joint du filtre', fait: true, duree: '1,5', note: 'joint fourni' }, { t: '', fait: false });
  d.materiel.push({ nom: 'Antigel biodégradable', qte: '20', unite: 'L' }, { nom: '', qte: '3' });
  assert.deepEqual(H.progress(d), { total: 52, done: 1, pct: 2 });
  const r = H.toReport(d, { site_id: '10' });
  assert.deepEqual(Object.keys(r).filter((k) => !schema.rapports_hivernage.includes(k)), []);
  assert.equal(r.objet, 'Hivernement — fermeture complète');
  assert.deepEqual(r.sections.slice(-2).map((s) => s.title), ['9. Travaux sur mesure', '10. Matériel et produits utilisés']);
  assert.deepEqual(r.sections.slice(-2).map((s) => s.items), [['✔ Remplacer le joint du filtre (1,5 h) — joint fourni'], ['Antigel biodégradable : 20 L']]);
  assert.deepEqual(H.fromReport(JSON.parse(JSON.stringify(r))), H.norm(d));
  const h = H.html(d);
  assert.match(h, /Fermeture complète/);
  assert.doesNotMatch(h, /Formation des employés|Fermeture avec formation/);
  assert.match(h, /9\. Travaux sur mesure[\s\S]*10\. Matériel et produits utilisés[\s\S]*11\. Remarques[\s\S]*12\. Validation/);
  assert.match(H.texte(d), /\(fermeture complète\)[\s\S]*Antigel biodégradable : 20 L/);
  d.type = 'autre'; d.type_nom = 'Fermeture des jeux seulement';
  assert.equal(H.typeDe(d).nom, 'Fermeture des jeux seulement');
  // Sections propres au site : une ligne par étape, groupées par titre, après les phases
  const adj = [{ id: 'l1', site_id: '10', domaine: 'hiv', action: 'ajouter', section: 'libre:Glissade', texte: 'Vidanger la glissade', actif: true, cree_le: '1' },
    { id: 'l2', site_id: '10', bassin_id: 'bp1', domaine: 'hiv', action: 'ajouter', section: 'libre:Glissade', texte: 'Retirer l’escalier', actif: true, cree_le: '2' }];
  const p = H.planPourSite({ nom: 'Parc Laval', bassins: [{ id: 'bp1', nom: 'Piscine' }] }, [], adj);
  const g = p.sections.find((s) => s.titre === 'Glissade');
  assert.deepEqual(g.items.map((i) => [i.k, i.t]), [['lib-l1', 'Vidanger la glissade'], ['lib-l2', 'Retirer l’escalier']]);
  assert.deepEqual(p.sections.slice(-3).map((s) => s.titre), ['Glissade', 'Matériel et pièces', 'Formation des employés']);
  assert.ok(!p.sections.some((s) => s.items.some((i) => i.t === 'Retirer l’escalier' && i.k !== 'lib-l2')), 'pas en double comme étape d’ouvrage');
  // Section de gabarit réservée à un type (éditeur texte et plan)
  const secs = H.deTexte('## Remise en eau [types: remise]\n1. Remplir le bassin\n## Fermeture\n1. Vidanger');
  assert.deepEqual(secs[0].types, ['remise']);
  assert.match(H.versTexte(secs), /## Remise en eau \[types: remise\]/);
  const rows = [{ code: 'piscine', nom: 'Piscine', types: ['GEN'], sections: secs, ordre: 1 }];
  const d2 = H.blank({ plan: H.planSite([{ id: 'b', nom: 'P', type_code: 'GEN' }], rows) });
  assert.deepEqual(H.sectionsDe(d2).map((s) => s.no + '. ' + s.titre), ['2. Fermeture']);
  d2.type = 'remise';
  assert.deepEqual(H.sectionsDe(d2).map((s) => s.no + '. ' + s.titre), ['2. Remise en eau', '3. Fermeture']);
});

test('sa-terrain : type choisi, travail sur mesure, matériel et nouvelle section pour le site', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await T(page, () => window.__terrain.setState({ hivSel: '10', screen: 'hivForm', hivVue: { mode: 'detail', texte: 'complet', ordre: 'toutes' } }));
  assert.match(await text(page), /Hivernement · Fermeture avec formation[\s\S]*0 cases sur 58/);
  await page.getByRole('group', { name: 'Type d’hivernement' }).getByRole('button', { name: 'Fermeture complète' }).click();
  let t = await text(page);
  assert.match(t, /Hivernement · Fermeture complète[\s\S]*0 cases sur 51/);
  assert.doesNotMatch(t, /Formation des employés/);
  await page.getByRole('button', { name: 'Ajouter un travail' }).click();
  await page.getByLabel('Travail', { exact: true }).fill('Remplacer le manomètre');
  await page.locator('[data-travail]').getByRole('button', { name: 'Fait' }).click();
  await page.getByRole('button', { name: 'Ajouter du matériel ou un produit' }).click();
  await page.getByLabel('Matériel ou produit').fill('Antigel biodégradable');
  await page.getByLabel('Quantité').fill('20');
  await page.getByLabel('Unité').fill('L');
  assert.match(await text(page), /1 cases sur 52/);
  // nouvelle section gardée pour le site
  await page.getByRole('button', { name: 'Modifier la liste pour ce site' }).click();
  await page.getByLabel('Titre de la nouvelle section').fill('Glissade');
  await page.getByLabel('Première étape de la nouvelle section').fill('Vidanger la glissade');
  await page.getByRole('button', { name: 'Créer la section' }).click();
  await page.getByLabel(/^Ajouter une étape : \d+\. Glissade$/).fill('Retirer l’escalier');
  await page.getByRole('button', { name: /^Ajouter l’étape : \d+\. Glissade$/ }).click();
  await noQueue(page);
  assert.deepEqual(db.rows('ouvrage_ajustements').map((r) => [r.site_id, r.bassin_id, r.action, r.section, r.texte]),
    [['10', null, 'ajouter', 'libre:Glissade', 'Vidanger la glissade'], ['10', null, 'ajouter', 'libre:Glissade', 'Retirer l’escalier']]);
  await page.getByRole('button', { name: 'Terminer les modifications' }).click();
  t = await text(page);
  assert.match(t, /\d+\. Glissade[\s\S]*Vidanger la glissade[\s\S]*Retirer l’escalier/);
  assert.match(t, /1 cases sur 54/);
  await page.getByRole('button', { name: 'Envoyer au bureau' }).click();
  await noQueue(page);
  const r = db.rows('rapports_hivernage').find((x) => String(x.site_id) === '10');
  const hv = H.fromReport(r);
  assert.equal(hv.type, 'complete');
  assert.deepEqual(hv.travaux, [{ t: 'Remplacer le manomètre', fait: true, note: '', duree: '' }]);
  assert.deepEqual(hv.materiel, [{ nom: 'Antigel biodégradable', qte: '20', unite: 'L' }]);
  assert.match(r.objet, /fermeture complète/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-admin : Hivernage dans « Sites et inspections », type, travaux et matériel ; sections propres au site', async () => {
  const t = tables();
  t.ouvrage_ajustements = [{ id: 'l1', site_id: '10', bassin_id: null, domaine: 'hiv', action: 'ajouter', section: 'libre:Glissade', texte: 'Vidanger la glissade', actif: true, par_nom: 'Kaël Test', cree_le: '2026-10-20T10:00:00Z' }];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  const nav = await page.evaluate(() => window.__admin.vals().navGroups.flatMap((g) => g.items.map((i) => i.label)));
  assert.ok(!nav.includes('Hivernage'), 'plus d’entrée séparée : l’hivernage est dans Sites et inspections');
  await page.evaluate(() => window.__admin.go('inspections'));
  const bar = page.getByRole('tablist', { name: 'Sites et inspections' });
  await bar.getByRole('tab', { name: 'Hivernage' }).click();
  assert.equal(await page.evaluate(() => window.__admin.state.mod), 'hivernage');
  assert.equal(await bar.getByRole('tab', { name: 'Hivernage' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => window.__admin.vals().navGroups.flatMap((g) => g.items).find((i) => i.label === 'Sites et inspections').fw), 600);
  // nouvelle liste depuis le site : type, travaux et matériel
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: 10, inspView: 'hiver' }));
  await page.locator('[data-libre="Glissade"]').waitFor();
  await page.getByLabel('Ajouter une étape : Glissade').fill('Retirer l’escalier');
  await page.locator('[data-libre="Glissade"]').getByRole('button', { name: 'Ajouter' }).click();
  await page.getByLabel('Titre de la nouvelle section').fill('Bâtiment des pompes');
  await page.getByLabel('Première étape de la nouvelle section').fill('Fermer l’entrée d’eau');
  await page.getByRole('button', { name: 'Créer la section' }).click();
  await page.locator('[data-libre="Bâtiment des pompes"]').waitFor();
  assert.deepEqual(db.rows('ouvrage_ajustements').filter((r) => r.id !== 'l1').map((r) => [r.site_id, r.bassin_id, r.section, r.texte, r.par_nom]),
    [['10', null, 'libre:Glissade', 'Retirer l’escalier', 'Bureau SA'], ['10', null, 'libre:Bâtiment des pompes', 'Fermer l’entrée d’eau', 'Bureau SA']]);
  await page.locator('[data-libre="Glissade"]').getByRole('button', { name: 'Retirer l’étape : Vidanger la glissade' }).click();
  await page.waitForFunction(() => !(window.__admin.D.adj || []).some((r) => r.id === 'l1'));
  assert.equal(db.rows('ouvrage_ajustements').find((r) => r.id === 'l1').actif, false);
  await page.getByRole('button', { name: 'Nouvel hivernement pour ce site' }).click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.hv);
  const dlg = page.locator('.dialog');
  assert.match(await dlg.innerText(), /Glissade[\s\S]*Retirer l’escalier[\s\S]*Bâtiment des pompes/i);
  await dlg.getByLabel('Type d’hivernement').selectOption('dormance');
  assert.match(await dlg.innerText(), /Hivernement · Mise en dormance/);
  assert.doesNotMatch(await dlg.innerText(), /Employés formés/);
  await dlg.getByRole('button', { name: '+ Ajouter un travail' }).click();
  const w = dlg.locator('[data-travail]');
  await w.getByLabel('Travail', { exact: true }).fill('Changer la valve 3 voies');
  await w.getByLabel('Heures').fill('2');
  await w.getByLabel('Travail fait').check();
  await dlg.getByRole('button', { name: '+ Ajouter du matériel ou un produit' }).click();
  const m = dlg.locator('[data-materiel]');
  await m.getByLabel('Matériel ou produit').fill('Chlore granulaire');
  await m.getByLabel('Quantité').fill('5');
  await m.getByLabel('Unité').fill('kg');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => /enregistré/.test(window.__admin.state.toast || ''));
  const r = db.rows('rapports_hivernage').find((x) => x.site_id && String(x.site_id) === '10');
  assert.ok(r);
  const hv = H.fromReport(r);
  assert.equal(hv.type, 'dormance');
  assert.deepEqual(hv.travaux, [{ t: 'Changer la valve 3 voies', fait: true, note: '', duree: '2' }]);
  assert.deepEqual(hv.materiel, [{ nom: 'Chlore granulaire', qte: '5', unite: 'kg' }]);
  assert.match(r.objet, /mise en dormance/);
  assert.ok(r.sections.some((s) => s.title === 'Matériel et produits utilisés' || /Matériel et produits utilisés$/.test(s.title)));
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain allégé : menus par section, critiques une à une, texte court, une section à la fois (gardé sur l’appareil)', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: tables() });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await T(page, () => window.__terrain.setState({ hivSel: '10', screen: 'hivForm' }));
  const p1 = page.locator('[data-section="3. Phase 1 — Vidange"]');
  // par défaut : sections repliées, seule l'étape critique visible, en texte court
  assert.deepEqual(await p1.getByRole('button', { name: /^★/ }).allTextContents(), ['★ 1. Vidanger le bassin au complet']);
  assert.doesNotMatch(await p1.innerText(), /Ouvrir toutes les vannes/);
  await p1.getByRole('button', { name: 'Section faite (sauf les étapes à cocher une à une)' }).click();
  assert.match(await p1.innerText(), /7 \/ 8 cases cochées/);
  const st = await T(page, () => window.__terrain.hivCur('10').c);
  assert.equal(st['p1-0'], undefined, 'l’étape critique n’est pas cochée par « Section faite »');
  assert.equal(st['p1-1'], true);
  await p1.getByRole('button', { name: /^★ 1\./ }).click();
  assert.match(await p1.innerText(), /8 \/ 8 cases cochées[\s\S]*Section faite ✓ — annuler/);
  await p1.getByRole('button', { name: 'Voir les 8 étapes' }).click();
  assert.match(await p1.innerText(), /15\. Vidanger les filtres\n/, 'texte court : sans la précision');
  // texte complet, puis une section à la fois
  await page.getByRole('group', { name: 'Affichage : Texte' }).getByRole('button', { name: 'Complet' }).click();
  assert.match(await p1.innerText(), /15\. Vidanger les filtres \(bouchon au bas du filtre\)/);
  await page.getByRole('group', { name: 'Affichage : Organisation' }).getByRole('button', { name: 'Une à la fois' }).click();
  assert.equal(await page.locator('[data-section]').count(), 1);
  assert.match(await text(page), /Section 1 sur 8/);
  await page.getByRole('button', { name: 'Suivante' }).click();
  assert.equal(await page.locator('[data-section]').getAttribute('data-section'), '3. Phase 1 — Vidange');
  assert.deepEqual(await T(page, () => JSON.parse(localStorage.getItem('sa_hiv_vue'))), { mode: 'section', texte: 'complet', ordre: 'une' });
  assert.deepEqual(errors, []);
  await page.close();
});

test('gabarit : « texte court » propre à une étape, utilisé sur le terrain, rapport complet', () => {
  const it = { t: 'Alimentation électrique des pompes, chauffe-eau et système de traitement coupée et verrouillée' };
  assert.equal(H.court(it), it.t, 'jamais coupé à une virgule');
  assert.equal(H.court(Object.assign({ court: 'Électricité coupée et cadenassée' }, it)), 'Électricité coupée et cadenassée');
  assert.equal(H.court({ t: 'Vidanger les filtres (bouchon au bas du filtre), remettre les bouchons' }), 'Vidanger les filtres');
  const rows = [{ code: 'piscine', nom: 'Piscine', types: ['GEN'], ordre: 1, sections: [{ id: 'p1', titre: 'Phase 1', items: [Object.assign({ n: '1', court: 'Électricité coupée' }, it)] }] }];
  const d = H.blank({ plan: H.planSite([{ id: 'b', nom: 'P', type_code: 'GEN' }], rows) });
  assert.equal(H.court(H.sectionsDe(d)[0].items[0]), 'Électricité coupée');
  assert.match(H.toReport(d, {}).sections[1].items[0], /coupée et verrouillée/);
});
