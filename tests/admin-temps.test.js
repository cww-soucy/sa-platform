'use strict';
// sa-admin — Temps · Paie et Stats : gérer les heures de l'équipe comme dans SA Platform.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, openApp, launch, dayIdx, weekKey, iso, addDays, mondayOf } = require('./harness');
const { base } = require('./fixtures');

const USER = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

async function temps(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await page.evaluate(() => window.__admin.go('temps'));
  await page.waitForFunction(() => Array.isArray(window.__admin.ftw[Object.keys(window.__admin.ftw)[0]]));
}
const A = (page, fn, arg) => page.evaluate(fn, arg);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const row = (db, uid) => db.rows('feuilles_temps').find((r) => r.uid === uid && r.week === weekKey());

function lireXlsx(buffer) {
  const f = path.join(os.tmpdir(), 'sa-' + Date.now() + '.xlsx');
  fs.writeFileSync(f, buffer);
  const out = execFileSync('python3', ['-c', `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1])
print(json.dumps({ws.title: [[c for c in r] for r in ws.iter_rows(values_only=True)] for ws in wb.worksheets}, default=str))
`, f]);
  return JSON.parse(out);
}
let openpyxl = true;
try { execFileSync('python3', ['-c', 'import openpyxl']); } catch (e) { openpyxl = false; }

test('Semaine : grille de l’équipe (total, régulières, supp.) et journée d’un employé', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await temps(page);
  const r = await A(page, () => window.__admin.vals().tRows.map((x) => [x.nom, x.total, x.reg, x.etat]));
  assert.deepEqual(r, [['Kaël Test', '1 h 00', '1 h 00', '1 à valider'], ['Autre Tech', '—', '—', '']]);
  await page.getByRole('button', { name: /^1 h 00/ }).first().click();
  await page.getByText('Entrepôt').first().waitFor();
  assert.match(await page.locator('.dialog').innerText(), /Kaël Test — \w+ \d+/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Journée : corriger l’heure de fin → heures recalculées, protocole SA Platform, journal d’audit', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await temps(page);
  await A(page, (i) => { const a = window.__admin; a.openDay('kael', a.vals().tLabel && Object.keys(a.ftw)[0], i); a.editPunch(0); }, dayIdx());
  await page.locator('.dialog input[type=time]').nth(1).fill('10:30');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Punch corrigé/);
  const t = row(db, 'kael').days[dayIdx()].tasks[0];
  assert.equal(t.end, '10:30');
  assert.equal(t.hrs, 3.5);
  assert.equal(t.pendingValidation, false);
  assert.ok(t.k && t.mod > 0);
  const au = db.rows('audit_log')[0];
  assert.equal(au.acteur, 'cwweil');
  assert.equal(au.details.action, 'correction_punch');
  await page.close();
});

test('Journée : ajouter un punch à un employé qui n’a pas encore de feuille cette semaine', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await temps(page);
  await A(page, (i) => { const a = window.__admin; a.openDay('kael2', Object.keys(a.ftw)[0], i); a.newPunch(); }, dayIdx());
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Indiquez l’heure de fin|Le lieu/);
  assert.equal(db.writes('feuilles_temps').length, 0, 'rien n’est écrit tant que le formulaire est incomplet');
  const f = page.locator('.dialog input');
  await f.nth(0).fill('Piscine Beta');
  await page.locator('.dialog input[type=time]').nth(0).fill('08:00');
  await page.locator('.dialog input[type=time]').nth(1).fill('12:15');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await toast(page, /Punch ajouté/);
  const r = row(db, 'kael2');
  assert.ok(r, 'feuille créée');
  assert.equal(r.days[dayIdx()].tasks[0].lieu, 'Piscine Beta');
  assert.equal(r.total_h, 4.25);
  await page.waitForFunction(() => window.__admin.vals().tRows[1].total === '4 h 15');
  await page.close();
});

test('Journée : supprimer un punch (confirmation, pierre tombale)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await temps(page);
  await A(page, (i) => { const a = window.__admin; a.openDay('kael', Object.keys(a.ftw)[0], i); a.editPunch(0); }, dayIdx());
  await page.getByRole('button', { name: 'Supprimer ce punch' }).click();
  assert.equal(db.writes('feuilles_temps').length, 0);
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await toast(page, /Punch supprimé/);
  const d = row(db, 'kael').days[dayIdx()];
  assert.equal(d.tasks.length, 0);
  assert.equal(d.del[0].sig, '07:00|Entrepôt');
  await page.close();
});

test('Approuver la semaine : chaque punch terminé porte l’approbation (qui, quand) et mod', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await temps(page);
  await page.getByRole('button', { name: 'Approuver la semaine' }).click();
  await toast(page, /Semaine approuvée/);
  const t = row(db, 'kael').days[dayIdx()].tasks[0];
  assert.equal(t.approuve, true);
  assert.equal(t.approuvePar, 'cwweil');
  assert.ok(t.mod > 0);
  await page.waitForFunction(() => window.__admin.vals().tRows[0].etat === 'Approuvée');
  await page.close();
});

test('Semaines plus anciennes : chargées à la demande (plus de limite à 8 semaines)', async () => {
  const tables = base();
  const vieux = iso(addDays(mondayOf(new Date()), -7 * 12));
  tables.feuilles_temps.push({ id: 'kael_' + vieux, uid: 'kael', emp: 'Kaël Test', week: vieux, days: [{ tasks: [{ lieu: 'Ancien', start: '08:00', end: '10:00', hrs: 2 }] }], total_h: 2, updated_at: 't' });
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await temps(page);
  for (let i = 0; i < 12; i++) await A(page, () => window.__admin.vals().tPrev());
  await page.waitForFunction(() => (window.__admin.vals().tRows[0] || {}).total === '2 h 00');
  assert.ok(db.log.some((l) => l.table === 'feuilles_temps' && l.query.includes('week=eq.' + vieux)));
  await page.close();
});

test('Paie : fichier Excel (.xlsx) lisible — sommaire, feuille par employé, journal ; heures en décimal', { skip: !openpyxl && 'openpyxl absent' }, async () => {
  const tables = base();
  const d = tables.feuilles_temps[0].days[dayIdx()];
  // deux punchs au même endroit le même jour = UNE ligne de feuille de temps (comme SA Platform)
  d.tasks.push({ id: 2, lieu: 'Entrepôt', start: '12:00', end: '13:30', hrs: 1.5, active: false });
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await temps(page);
  await A(page, () => window.__admin.setState({ tempsTab: 'paie' }));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger Excel' }).click()]);
  assert.match(dl.suggestedFilename(), /^SoucyAquatik_Feuilles_de_temps_\d{4}-\d\d-\d\d\.xlsx$/);
  const wb = lireXlsx(fs.readFileSync(await dl.path()));
  assert.deepEqual(Object.keys(wb), ['Sommaire', 'Kaël Test', 'Journal des punchs']);
  assert.deepEqual(wb.Sommaire[3].slice(0, 5), ['Kaël Test', 2.5, 2.5, 0, 2]);
  const lignes = wb['Kaël Test'].filter((r) => r[2] === 'Entrepôt');
  assert.equal(lignes.length, 1, 'punchs regroupés en une ligne');
  assert.equal(lignes[0][7], 2.5);
  assert.equal(lignes[0][8], 2);
  assert.equal(wb['Journal des punchs'].length, 3, 'en-tête + 2 punchs');
  await page.close();
});

test('Paie : marquer envoyée à la paie (table partagée avec SA Platform)', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await temps(page);
  await A(page, () => window.__admin.setState({ tempsTab: 'paie' }));
  await page.getByRole('button', { name: 'Marquer envoyée(s) à la paie' }).click();
  await toast(page, /marquée\(s\) envoyée/);
  const e = db.rows('feuilles_temps_envois')[0];
  assert.equal(e.id, 'kael_' + weekKey());
  assert.equal(e.heures, 1);
  await page.waitForFunction(() => /Envoyée à la paie le/.test(window.__admin.vals().paie[0].statut));
  await page.close();
});

test('Stats : heures de l’équipe, bons de travail, rapport téléchargeable', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => window.__admin.go('stats'));
  await page.waitForFunction(() => !window.__admin.vals().sLoading);
  const v = await A(page, () => { const x = window.__admin.vals(); return { k: x.sKpis.map((k) => k.v), bars: x.sBars.map((b) => b.nom + ' ' + b.h) }; });
  assert.deepEqual(v.k, ['1 h 00', '1', '2', '0']);
  assert.deepEqual(v.bars, ['Kaël Test 1 h 00']);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger (.txt)' }).click()]);
  const txt = fs.readFileSync(await dl.path(), 'utf8');
  assert.match(txt, /Kaël Test \| Total: 1 h 00 \| Régulier: 1 h 00 \| Supp: 0 h 00 \| Punchs: 1/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('Facturation : export en vrai classeur Excel', { skip: !openpyxl && 'openpyxl absent' }, async () => {
  const { page } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => window.__admin.go('facturation'));
  const [dl] = await Promise.all([page.waitForEvent('download'), A(page, () => window.__admin.vals().exportXls())]);
  const wb = lireXlsx(fs.readFileSync(await dl.path()));
  assert.equal(wb.Facturation[1][1], 'Ville X');
  assert.equal(wb.Facturation[1][6], 1000);
  assert.equal(wb.Facturation[2][6], 1000, 'ligne de total');
  await page.close();
});
