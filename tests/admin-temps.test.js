'use strict';
// sa-admin — Temps · Paie et Stats : gérer les heures de l'équipe comme dans SA Platform.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, openApp, launch, dayIdx, weekKey, iso, addDays, mondayOf, attendre } = require('./harness');
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

test('Semaine : ✓ « journée approuvée » seulement s’il y a un punch terminé, tous approuvés (un punch en cours seul n’en a pas)', async () => {
  const t = base(), di = dayIdx(), autre = (di + 6) % 7;
  const ft = t.feuilles_temps[0];
  ft.days[di].tasks = [{ id: 1, lieu: 'Piscine Alpha', start: '07:00', end: '', hrs: 0, active: true }];
  ft.days[autre].tasks = [
    { id: 2, lieu: 'Piscine Beta', start: '07:00', end: '09:00', hrs: 2, active: false, approuve: true },
    { id: 3, lieu: 'Piscine Beta', start: '09:00', end: '', hrs: 0, active: true },
  ];
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: t });
  await temps(page);
  const j = await A(page, () => window.__admin.vals().tRows.find((x) => x.nom === 'Kaël Test').jours.map((d) => d.txt + d.ok));
  assert.equal(j[di], ' ●', 'punch actif seul : ● sans ✓');
  assert.equal(j[autre], '2 h 00 ●✓', 'punch terminé approuvé + punch actif : ●✓');
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
  // le journal d'audit part à côté de l'écriture, sans l'attendre
  await attendre(page, () => db.rows('audit_log').length > 0);
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
  assert.deepEqual(Object.keys(wb), ['Sommaire', 'Heures par projet', 'Kaël Test', 'Journal des punchs', 'Projets']);
  assert.deepEqual(wb.Sommaire[3].slice(0, 5), ['Kaël Test', 2.5, 2.5, 0, 2]);
  const lignes = wb['Kaël Test'].filter((r) => r[2] === 'Entrepôt');
  assert.equal(lignes.length, 1, 'punchs regroupés en une ligne');
  assert.equal(lignes[0][7], 2.5);
  assert.equal(lignes[0][8], 2);
  assert.equal(wb['Journal des punchs'].length, 4, 'titre + en-tête + 2 punchs');
  await page.close();
});

/* Gabarit de Charles (SoucyAquatik_Feuilles_de_temps_2026-10-26.xlsx) : mêmes feuilles, colonnes, formules et mise en forme. */
function lireGabarit(buffer) {
  const f = path.join(os.tmpdir(), 'sa-g-' + Date.now() + '.xlsx');
  fs.writeFileSync(f, buffer);
  const out = execFileSync('python3', ['-c', `
import openpyxl, json, sys, zipfile
from openpyxl.worksheet.formula import ArrayFormula
wb = openpyxl.load_workbook(sys.argv[1])
def val(c):
    v = c.value
    if isinstance(v, ArrayFormula): return {'f': v.text, 'ref': v.ref}
    return v
r = {}
for ws in wb.worksheets:
    r[ws.title] = {'cells': {c.coordinate: val(c) for row in ws.iter_rows() for c in row if c.value is not None},
      'fill': {c.coordinate: c.fill.fgColor.rgb for row in ws.iter_rows() for c in row if c.fill.fill_type},
      'bold': [c.coordinate for row in ws.iter_rows() for c in row if c.font.b],
      'fmt': {c.coordinate: c.number_format for row in ws.iter_rows() for c in row if c.number_format != 'General'},
      'freeze': ws.freeze_panes, 'merged': [str(m) for m in ws.merged_cells.ranges], 'h1': ws.row_dimensions[1].height, 'images': len(ws._images)}
z = zipfile.ZipFile(sys.argv[1])
r['_files'] = z.namelist()
r['_cm'] = sum(z.read(n).decode().count('cm="1"') for n in z.namelist() if n.startswith('xl/worksheets/sheet'))
r['_calc'] = 'fullCalcOnLoad="1"' in z.read('xl/workbook.xml').decode()
print(json.dumps(r, default=str))
`, f]);
  return JSON.parse(out);
}

test('Paie : Excel selon le gabarit — Heures par projet, Projets (site reconnu), sous-totaux, total officiel, formules', { skip: !openpyxl && 'openpyxl absent' }, async () => {
  const tables = base(), di = dayIdx(), autre = (di + 1) % 7, wk = weekKey();
  const d = tables.feuilles_temps[0].days;
  d[di].tasks.push({ id: 2, lieu: 'Vieux doublon', siteId: 3, start: '09:00', end: '11:30', hrs: 2.5, active: false, approuve: true });
  d[autre].tasks.push({ id: 3, lieu: 'piscine beta', start: '07:00', end: '08:20', hrs: 1.3333, active: false, odt: 'ODT-9' });
  const days2 = d.map(() => ({ status: 'idle', tasks: [], saved: false, kmArr: '', stopFiles: [], del: [] }));
  days2[di].tasks.push({ id: 1, lieu: 'Piscine Alpha', start: '07:00', end: '12:00', hrs: 5, active: false });
  tables.feuilles_temps.push({ id: 'kael2_' + wk, uid: 'kael2', emp: 'Autre Tech', week: wk, days: days2, total_h: 5, updated_at: '2026-01-01T00:00:00Z' });
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await temps(page);
  await A(page, () => window.__admin.setState({ tempsTab: 'paie' }));
  await A(page, () => window.__admin.vals().paieAll());
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger Excel' }).click()]);
  const buf = fs.readFileSync(await dl.path());
  if (process.env.SA_XLSX_OUT) fs.writeFileSync(process.env.SA_XLSX_OUT, buf);
  const wb = lireGabarit(buf);
  assert.deepEqual(Object.keys(wb).filter((k) => k[0] !== '_'), ['Sommaire', 'Heures par projet', 'Kaël Test', 'Autre Tech', 'Journal des punchs', 'Projets']);
  assert.ok(wb._files.includes('xl/metadata.xml') && wb._files.includes('xl/media/image1.png'), 'formules dynamiques + logo');
  assert.ok(wb._calc, 'recalcul à l’ouverture');
  for (const k of Object.keys(wb).filter((k) => k[0] !== '_')) { assert.equal(wb[k].h1, 43.5, k); assert.equal(wb[k].images, 1, 'logo ' + k); }

  // Projets : lieu tel qu'exporté → site reconnu (fusion suivie, majuscules ignorées), sinon le lieu lui-même
  const P = wb.Projets.cells;
  assert.equal(P.A4, "Lieu / site (tel qu'exporté)");
  const map = {}; for (let r = 5; P['A' + r]; r++) map[P['A' + r]] = P['B' + r];
  assert.deepEqual(map, { 'Entrepôt': 'Entrepôt', 'Piscine Alpha': 'Piscine Alpha', 'Vieux doublon': 'Piscine Alpha', 'piscine beta': 'Piscine Beta' });
  assert.equal(wb.Projets.freeze, 'A5');

  // Feuille employé : en-têtes, ligne de jour, lignes, sous-total, bloc total, colonne Projet en formule
  const K = wb['Kaël Test'], C = K.cells;
  assert.deepEqual(K.merged, ['A1:K1']); assert.equal(K.freeze, 'A4');
  assert.deepEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'M', 'N', 'O'].map((x) => C[x + '3']),
    ['Jour', 'Date', 'Lieu / site', 'ODT', 'Détail', 'Début', 'Fin', 'Heures', 'Punchs', 'Note', 'Projet', 'Heures par projet', 'Heures', '% du total']);
  assert.match(C.A4, /^\w+ — \d{4}-\d\d-\d\d$/);
  assert.equal(K.fill.A4, 'FFD6E6F5');
  assert.equal(C.K5, '=IFERROR(INDEX(Projets!$B:$B,MATCH(C5,Projets!$A:$A,0)),C5)');
  const st = Object.keys(C).filter((k) => /^A\d+$/.test(k) && /^Sous-total /.test(C[k]));
  assert.equal(st.length, 2, 'un sous-total par jour travaillé');
  assert.match(C['H' + st[0].slice(1)], /^=SUM\(H\d+:H\d+\)$/);
  const T = +Object.keys(C).find((k) => C[k] === 'Total (officiel, export)').slice(1);
  assert.equal(C['H' + T], 4.83);
  assert.equal(C['I' + T], '=SUMIFS($I$4:$I$' + (T - 1) + ',$A$4:$A$' + (T - 1) + ',"Sous-total*")');
  assert.deepEqual([C['A' + (T + 1)], C['A' + (T + 2)], C['A' + (T + 3)], C['A' + (T + 4)]], ['Régulières', 'Supplémentaires', 'Somme des lignes (arrondies)', "Écart d'arrondi"]);
  assert.equal(C['H' + (T + 4)], '=H' + (T + 3) + '-H' + T);
  assert.deepEqual(C.M5, { f: '=_xlfn._xlws.SORT(_xlfn.UNIQUE(_xlfn._xlws.FILTER($K$4:$K$' + (T - 1) + ',$K$4:$K$' + (T - 1) + '<>"")))', ref: 'M5:M7' });
  assert.equal(C.N4, '=SUM(_xlfn.ANCHORARRAY(N5))');

  // Heures par projet : un bloc par projet, un par site, une colonne par employé
  const H = wb['Heures par projet'].cells;
  assert.deepEqual([H.A5, H.B5, H.C5, H.D5, H.E5, H.G5, H.H5, H.I5, H.J5, H.K5], ['Projet', 'Kaël Test', 'Autre Tech', 'Total', '% du total', 'Lieu / site', 'Kaël Test', 'Autre Tech', 'Total', 'Projet']);
  assert.deepEqual(H.A7, { f: '=_xlfn._xlws.SORT(_xlfn.UNIQUE(_xlfn._xlws.FILTER(Projets!$B$5:$B$200,Projets!$B$5:$B$200<>"")))', ref: 'A7:A9' });
  assert.deepEqual(H.B7, { f: "=SUMIFS('Kaël Test'!$H:$H,'Kaël Test'!$K:$K,_xlfn.ANCHORARRAY($A$7))", ref: 'B7:B9' });
  assert.deepEqual(H.D7.f, '=_xlfn.ANCHORARRAY(B7)+_xlfn.ANCHORARRAY(C7)');
  assert.deepEqual(H.I7, { f: "=SUMIFS('Autre Tech'!$H:$H,'Autre Tech'!$C:$C,_xlfn.ANCHORARRAY($G$7))", ref: 'I7:I10' });
  assert.equal(H.D6, '=SUM(_xlfn.ANCHORARRAY(D7))');
  assert.deepEqual([H.A8, H.D8], ['Piscine Alpha', 7.5], 'valeurs déjà calculées : Alpha = 2,5 (Kaël, via la fusion) + 5 (Autre)');
  assert.equal(wb['Heures par projet'].freeze, 'A6');
  assert.ok(wb._cm >= 12, 'formules dynamiques marquées pour Excel 365');

  // Journal : titre, colonne Projet, bandes par journée
  const J = wb['Journal des punchs'];
  assert.equal(J.cells.A2, 'Employé'); assert.equal(J.cells.K2, 'Projet'); assert.equal(J.freeze, 'A3');
  assert.equal(J.cells.K3, '=IFERROR(INDEX(Projets!$B:$B,MATCH(G3,Projets!$A:$A,0)),G3)');
  assert.deepEqual(errors, []);
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

test('Paie : courriel à la paie (Excel + message prêt + marquée envoyée) et courriel à l’employé', async () => {
  const tables = base(); tables.comptes.find((c) => c.id === 'kael').email = 'kael@exemple.com';
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables });
  await temps(page);
  await A(page, () => { window.__mails = []; window.__openMail = (u) => window.__mails.push(u); window.__admin.setState({ tempsTab: 'paie' }); });
  await page.getByLabel('Courriel de la paie').fill('paie@soucy.test');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Préparer le courriel à la paie' }).click()]);
  assert.match(dl.suggestedFilename(), /\.xlsx$/);
  await toast(page, /marquée\(s\) envoyée/);
  const u = await A(page, () => window.__mails[0]);
  assert.match(u, /^mailto:paie@soucy\.test\?subject=/);
  const body = decodeURIComponent(u.split('&body=')[1]);
  assert.match(body, /Kaël Test : 1,00 h \(régulières 1,00\)/);
  assert.match(body, /Total de l’équipe : 1,00 h/);
  assert.equal(db.rows('feuilles_temps_envois')[0].methode, 'courriel');
  assert.equal(await A(page, () => localStorage.getItem('sa_admin_email_paie')), 'paie@soucy.test', 'adresse retenue');
  await A(page, () => window.__admin.vals().paie[0].expand());
  await page.getByRole('button', { name: /Courriel à Kaël \(kael@exemple\.com\)/ }).click();
  const u2 = await A(page, () => window.__mails[1]);
  assert.match(u2, /^mailto:kael@exemple\.com\?subject=Ta%20feuille%20de%20temps/);
  assert.match(decodeURIComponent(u2.split('&body=')[1]), /Bonjour Kaël,[\s\S]*Total : 1,00 h/);
  assert.deepEqual(errors, []);
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

test('Stats : « Analyser avec Claude » copie le rapport (format SA Platform + demande d’analyse) et ouvre Claude', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: USER, tables: base() });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url });
  await page.context().route('https://claude.ai/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'Claude' }));
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => window.__admin.go('stats'));
  await page.waitForFunction(() => !window.__admin.vals().sLoading);
  const [pop] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Analyser avec Claude' }).click()]);
  assert.match(pop.url(), /claude\.ai\/new/);
  await pop.close();
  await toast(page, /collez-le dans Claude/);
  const t = await A(page, () => navigator.clipboard.readText());
  assert.match(t, /^Tu es l’assistant de gestion de Soucy Aquatik/);
  assert.match(t, /Employé \| Jour \| Début \| Fin \| Durée \| Lieu \| Adresse \| ODT \| Détail \| Km/);
  assert.match(t, /Kaël Test \| Total: 1 h 00 .*\| Sem\. préc\./);
  assert.match(t, /── BONS DE TRAVAIL OUVERTS \(2\) ──/);
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
