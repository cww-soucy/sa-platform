'use strict';
// Type de job « Hivernement » : le bon de travail porte l'ODT saisi à la main et crée la cédule d'hivernement du site
// (rapports_hivernage, status « planifie »), vue au bureau (Sites et inspections › Hivernement) et sur le terrain (« Prévu le … »).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, addDays } = require('./harness');
const { base } = require('./fixtures');
const SCHEMA = require('./schema.json');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const A = (page, fn, arg) => page.evaluate(fn, arg);
const dans = (n) => iso(addDays(new Date(), n));

async function nouveauBon(page, f) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, (f) => { const a = window.__admin; a.openFE('wo', null, { tech: 'kael', debut: f.date }); Object.keys(f).forEach((k) => { if (k !== 'date') a.feSet(k, f[k]); }); }, f);
}

test('Hivernement figure dans les types du bon de travail et du créneau ; ODT et site exigés', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await nouveauBon(page, { date: dans(5), client: 'Client inconnu', type: 'hivernement' });
  let v = await A(page, () => window.__admin.vals());
  assert.ok(v.fTypes.some((o) => o.v === 'hivernement' && o.l === 'Hivernement' && o.sel));
  assert.equal(v.odtLbl, 'N° d’ODT (obligatoire)');
  assert.ok(v.isHivWO);
  await A(page, () => window.__admin.feSave());
  await toast(page, /ODT est requis/);
  await A(page, () => window.__admin.feSet('odt', '24-1187'));
  await A(page, () => window.__admin.feSave());
  await toast(page, /choisissez le client dans la liste des sites/);
  assert.equal(db.rows('workorders').length, 2, 'rien de créé');
  await A(page, () => window.__admin.openFE('plan', null, {}));
  v = await A(page, () => window.__admin.vals());
  assert.ok(v.fTypes.some((o) => o.v === 'hivernement'), 'aussi dans les types du créneau');
  assert.deepEqual(errors, []);
  await page.close();
});

test('bon de travail Hivernement : WO avec l’ODT + cédule du site ; date suivie ; suppression', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await nouveauBon(page, { date: dans(5), client: 'Piscine Alpha Sud', type: 'hivernement', odt: ' 24-1187 ' });
  const note = await A(page, () => window.__admin.vals().hivWoNote);
  assert.match(note, /cédule d’hivernement de « Piscine Alpha Sud » sera créée/);
  await A(page, () => window.__admin.feSave());
  await toast(page, /Bon de travail créé · cédule d’hivernement créée dans le site/);
  const wo = db.rows('workorders').find((w) => w.type === 'hivernement');
  assert.equal(wo.odt, '24-1187');
  assert.equal(wo.client, 'Piscine Alpha Sud');
  const ced = db.rows('rapports_hivernage').filter((r) => r.wo_id === wo.id);
  assert.equal(ced.length, 1);
  assert.equal(ced[0].status, 'planifie');
  assert.equal(ced[0].odt, '24-1187');
  assert.equal(ced[0].site_id, '4');
  assert.equal(ced[0].date_inspection, dans(5));
  assert.equal(ced[0].technicien, 'Kaël Test');
  const h = ced[0].sections[0].hivernement;
  assert.equal(h.info.odt, '24-1187');
  assert.ok(h.plan && h.plan.sections.length, 'liste du site figée dans la cédule');

  // Bureau : Sites et inspections › Hivernement du site
  await A(page, () => window.__admin.loadDocs('hv', true));
  await page.waitForFunction(() => Array.isArray(window.__admin.docs.hv) && window.__admin.docs.hv.length);
  const hs = await A(page, () => { const a = window.__admin, v = a.hivSiteVals(a.D.byId[4]); return { etat: v.rows.map((r) => r.etat), resume: v.resume }; });
  assert.deepEqual(hs.etat, ['Planifié le ' + dans(5) + ' · ODT 24-1187']);
  assert.match(hs.resume, /^Pas encore d’hivernement cette année · Planifié le /);

  // Date du bon changée : la cédule encore planifiée suit
  await A(page, (id) => window.__admin.openFE('wo', id), wo.id);
  await page.waitForFunction(() => window.__admin.state.fe && !window.__admin.state.fe.loading);
  await A(page, (d) => window.__admin.feSet('date', d), dans(9));
  await A(page, () => window.__admin.feSave());
  await toast(page, /Bon de travail enregistré · cédule d’hivernement mise à jour/);
  assert.equal(db.rows('rapports_hivernage').filter((r) => r.wo_id === wo.id).length, 1, 'pas de doublon');
  assert.equal(db.rows('rapports_hivernage').find((r) => r.wo_id === wo.id).date_inspection, dans(9));

  // Bon supprimé : la cédule non commencée part avec lui
  await A(page, (id) => window.__admin.openFE('wo', id), wo.id);
  await page.waitForFunction(() => window.__admin.state.fe && !window.__admin.state.fe.loading);
  await A(page, () => window.__admin.feDelete(1));
  await A(page, () => window.__admin.feDelete(1));
  await toast(page, /1 supprimé/);
  await page.waitForFunction(() => true);
  await page.waitForTimeout(200);
  assert.equal(db.rows('rapports_hivernage').filter((r) => r.wo_id === wo.id).length, 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('avant la migration (colonnes odt / wo_id absentes) : WO et cédule créés quand même, ODT dans la description', async () => {
  const sauve = { wo: SCHEMA.workorders.slice(), hv: SCHEMA.rapports_hivernage.slice() };
  SCHEMA.workorders.splice(0, SCHEMA.workorders.length, ...sauve.wo.filter((c) => c !== 'odt'));
  SCHEMA.rapports_hivernage.splice(0, SCHEMA.rapports_hivernage.length, ...sauve.hv.filter((c) => c !== 'odt' && c !== 'wo_id'));
  try {
    const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
    await nouveauBon(page, { date: dans(3), client: 'Piscine Alpha Sud', type: 'hivernement', odt: '24-2000', descr: 'Fermeture complète' });
    await A(page, () => window.__admin.feSave());
    await toast(page, /Bon de travail créé · cédule d’hivernement créée dans le site/);
    const wo = db.rows('workorders').find((w) => w.type === 'hivernement');
    assert.equal(wo.odt, undefined);
    assert.equal(wo.descr, 'ODT : 24-2000\nFermeture complète');
    const ced = db.rows('rapports_hivernage').find((r) => r.status === 'planifie');
    assert.ok(ced, 'cédule créée');
    assert.equal(ced.sections[0].hivernement.info.odt, '24-2000');
    assert.equal(ced.sections[0].hivernement.info.wo_id, wo.id);
    assert.deepEqual(errors.filter((e) => !/400/.test(e)), []);
    await page.close();
  } finally {
    SCHEMA.workorders.splice(0, SCHEMA.workorders.length, ...sauve.wo);
    SCHEMA.rapports_hivernage.splice(0, SCHEMA.rapports_hivernage.length, ...sauve.hv);
  }
});

test('sa-terrain : la cédule planifiée est « Prévu le … » (pas faite) et la liste envoyée la remplit (même ligne)', async () => {
  const t = base();
  t.rapports_hivernage = (t.rapports_hivernage || []).concat([{ id: 'ced-1', site_id: '4', site_nom: 'Piscine Alpha Sud', status: 'planifie', date_inspection: dans(4), technicien: 'Kaël Test', wo_id: 'wo-h', odt: '24-1187',
    sections: [{ id: 'hivernement', title: 'x', items: [], photos: [], hivernement: { info: { odt: '24-1187', wo_id: 'wo-h' } } }] }]);
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  await page.waitForFunction(() => window.__terrain && window.__terrain.syncAt);
  await A(page, () => window.__terrain.vals().goHiv());
  await page.waitForFunction(() => Object.keys(window.__terrain.hivPrevu || {}).length === 1);
  const v = await A(page, () => { const x = window.__terrain.vals(); return { done: x.hivDoneCount, list: x.hivList.map((h) => h.nom + ' : ' + h.statutTxt) }; });
  assert.equal(v.done, 1, 'la cédule ne compte pas comme faite');
  assert.deepEqual(v.list, ['Piscine Alpha Sud : Prévu le ' + dans(4)]);
  await page.getByRole('button', { name: /Piscine Alpha Sud/ }).click();
  await page.getByRole('button', { name: 'Envoyer au bureau' }).click();
  await page.waitForFunction(() => !window.__terrain._pend && !JSON.parse(localStorage.getItem('sa_terrain_queue') || '[]').length);
  const L = db.rows('rapports_hivernage').filter((r) => r.site_id === '4' || r.site_id === 4);
  assert.equal(L.length, 1, 'pas de deuxième liste');
  assert.equal(L[0].id, 'ced-1');
  assert.equal(L[0].status, 'brouillon');
  assert.equal(L[0].wo_id, 'wo-h', 'lien au bon conservé');
  assert.equal(L[0].odt, '24-1187');
  assert.deepEqual(errors, []);
  await page.close();
});
