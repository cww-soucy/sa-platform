'use strict';
// Inspections personnalisées : modèles d'inspection (gabarits_hivernage.types = ['_insp'], dont « Inspection après chantier » intégré),
// saisie dans sa-admin depuis Sites et inspections, points Conforme / À corriger / S.O. avec note, rapport et déficiences.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/hivernage/checklist.js');
const schema = require('./schema.json');
const { startServer, openApp, launch } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  t.sites.push({ id: 10, nom: 'Parc Laval', addr: '1 rue A, Québec', notes: '', email: 'client@exemple.ca', bassins: [{ id: 'bp1', nom: 'Piscine', type: 'piscine', type_code: 'GEN' }] });
  t.contrats.push({ site_id: 10, type_code: 'GEN', code: 'C-010' });
  t.ouvrage_ajustements = [];
  return t;
}

test('modèle : inspection après chantier intégrée, déficiences, rapport ; jamais pris pour un gabarit d’hivernage', () => {
  const m = H.modelesInsp([]).find((x) => x.code === 'insp-apres-chantier');
  assert.ok(m && m.sections.every((s) => s.items.every((i) => i.choix.join() === 'Conforme,À corriger,S.O.')));
  assert.deepEqual(H.gabarits([Object.assign({}, m, { actif: true })]).map((g) => g.code), ['piscine', 'jeuxdeau', 'fontaine']);
  const d = H.blank({ site: 'Parc Laval', date: '2026-10-27', genre: 'insp', modele: m.code, modele_nom: m.nom, plan: H.planInsp(m) });
  d.c['bassin-5'] = 'À corriger'; d.notes['bassin-5'] = 'Grille manquante au drain principal'; d.c['site-0'] = 'Conforme';
  assert.deepEqual(H.aCorriger(d).map((x) => [x.section, x.note]), [['Bassin et surfaces', 'Grille manquante au drain principal']]);
  const r = H.toReport(d, { site_id: '10' });
  assert.deepEqual(Object.keys(r).filter((k) => !schema.rapports_hivernage.includes(k)), []);
  assert.deepEqual([r.objet, r.titre], ['Inspection après chantier', 'Inspection — Parc Laval']);
  assert.deepEqual(H.fromReport(JSON.parse(JSON.stringify(r))), H.norm(d));
  const h = H.html(d);
  assert.match(h, /Rapport d’inspection · Inspection après chantier[\s\S]*Points inspectés[\s\S]*Déficiences à corriger[\s\S]*Grille manquante au drain principal/);
  assert.doesNotMatch(h, /Formation des employés|Hivernement/);
  assert.match(H.texte(d), /rapport d’inspection \(inspection après chantier\) de Parc Laval[\s\S]*Grille manquante/);
  assert.equal(H.fichier(d), 'Inspection-Parc-Laval-2026-10-27.html');
  // un modèle de la base remplace le modèle intégré du même code et s'ajoute aux autres
  const L = H.modelesInsp([{ code: 'insp-apres-chantier', nom: 'Après chantier (maison)', types: ['_insp'], sections: m.sections, ordre: 1 }, { code: 'insp-reception', nom: 'Réception', types: ['_insp'], sections: m.sections.slice(0, 1), ordre: 2 }]);
  assert.deepEqual(L.map((x) => x.nom), ['Après chantier (maison)', 'Réception']);
});

test('sa-admin : inspection personnalisée depuis le site, point à corriger avec note, rapport enregistré ; nouveau modèle', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: 10 }));
  await page.getByLabel('Modèle d’inspection').waitFor();
  assert.equal(await page.getByLabel('Modèle d’inspection').inputValue(), 'insp-apres-chantier');
  await page.getByRole('button', { name: 'Inspection personnalisée' }).click();
  await page.waitForFunction(() => window.__admin.state.de && window.__admin.state.de.hv);
  const dlg = page.locator('.dialog');
  const t0 = await dlg.innerText();
  assert.match(t0, /Nouveau · Inspection · Inspection après chantier — Parc Laval/);
  assert.match(t0, /Site et sécurité[\s\S]*Bassin et surfaces/i);
  assert.doesNotMatch(t0, /Type d’hivernement|Travaux sur mesure|Employés formés/);
  const g = dlg.getByRole('group', { name: 'Grilles de drains de fond en place et vissées' });
  await g.getByRole('button', { name: 'À corriger' }).click();
  await g.getByLabel(/^Note :/).fill('Grille manquante au drain principal');
  await dlg.getByRole('group', { name: /^Chantier nettoyé/ }).getByRole('button', { name: 'Conforme' }).click();
  assert.match(await dlg.innerText(), /1 point\(s\) à corriger/);
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => /enregistr/i.test(window.__admin.state.toast || ''));
  const r = db.rows('rapports_hivernage').find((x) => String(x.site_id) === '10');
  assert.ok(r);
  const d = H.fromReport(r);
  assert.deepEqual([d.genre, d.modele, r.objet], ['insp', 'insp-apres-chantier', 'Inspection après chantier']);
  assert.equal(d.notes['bassin-5'], 'Grille manquante au drain principal');
  // historique du site : l'inspection y est, avec ses déficiences ; pas dans l'onglet Hivernement
  assert.equal(await page.evaluate(() => window.__admin.state.toast), 'Rapport d’inspection enregistré');
  await page.evaluate(() => window.__admin.setState({ de: null, inspView: 'visite' }));
  await page.waitForFunction(() => /1 point\(s\) à corriger/.test(document.body.innerText));
  assert.match(await page.locator('#app').innerText(), /Inspection après chantier/);
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: 10, inspView: 'hiver' }));
  await page.locator('[data-hiv-libres]').waitFor();
  assert.equal(await page.locator('tr[data-hiv]').count(), 0);
  // nouveau modèle d'inspection
  await page.evaluate(() => window.__admin.go('inspections', { inspSite: 10, inspView: 'visite' }));
  await page.getByRole('button', { name: 'Modèles' }).click();
  await page.getByRole('button', { name: '+ Nouveau modèle' }).click();
  const gd = page.locator('.dialog').last();
  await gd.locator('.field').filter({ hasText: /^Nom/ }).locator('input').first().fill('Inspection de réception');
  await gd.getByRole('group', { name: 'Étape 1 de la section 2' }).getByLabel('Texte de l’étape').fill('Couvercle de puisard en place');
  await gd.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForFunction(() => !window.__admin.state.gb);
  const m = db.rows('gabarits_hivernage').find((x) => x.nom === 'Inspection de réception');
  assert.ok(m);
  assert.deepEqual(m.types, ['_insp']);
  assert.deepEqual(m.sections[0].items[0].choix, ['Conforme', 'À corriger', 'S.O.']);
  assert.ok(db.rows('gabarits_hivernage').some((x) => x.code === 'piscine'), 'gabarits d’hivernage par défaut copiés aussi');
  await page.waitForFunction(() => [...document.querySelectorAll('select[aria-label="Modèle d’inspection"] option')].some((o) => o.textContent === 'Inspection de réception'));
  assert.deepEqual(errors, []);
  await page.close();
});
