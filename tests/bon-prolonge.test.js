'use strict';
// Bon de travail prolongé sur d'autres journées (« Prolonger » dans l'éditeur du bon, sa-admin) :
// chaque journée de plus est une tâche planning liée au bon (wo_id), jamais une copie du bon.
// Le bon apparaît alors aussi ces jours-là : planning, Plan de Match, tournée sa-terrain.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso, addDays, today } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
const TECH = { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '', email: '' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const A = (page, fn, arg) => page.evaluate(fn, arg);
const dans = (n) => iso(addDays(new Date(), n));
const suites = (db) => db.rows('planning_tasks').filter((t) => t.descr === 'Suite du bon de travail');

async function ouvrirBon(page, id) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, (id) => window.__admin.openFE('wo', id), id);
  await page.waitForFunction(() => { const fe = window.__admin.state.fe; return fe && !fe.loading && Array.isArray(fe.suite); });
}

test('Prolonger : une journée de plus liée au bon, sans copie du bon ; refus d’un jour déjà prévu ; retrait', async () => {
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: base() });
  await ouvrirBon(page, 'wo-mine');
  let v = await A(page, () => window.__admin.vals());
  assert.ok(v.woSuiteShow && v.woSuiteReady);
  assert.equal(v.woSuite.length, 1);
  assert.match(v.woSuite[0].l, /^Jour 1 · .* — date du bon$/);
  // Date proposée : le prochain jour ouvrable après le bon
  const prop = v.woSuiteDate, jp = new Date(prop + 'T12:00:00').getDay();
  assert.ok(prop > today() && jp !== 0 && jp !== 6, prop);

  await A(page, (d) => window.__admin.vals().onWoSuiteDate({ target: { value: d } }), dans(2));
  await A(page, () => window.__admin.vals().woProlonger());
  await toast(page, /Bon de travail prolongé : aussi prévu /);
  assert.equal(db.rows('workorders').length, 2, 'le bon n’est pas dupliqué');
  const s = suites(db);
  assert.equal(s.length, 1);
  assert.equal(s[0].wo_id, 'wo-mine');
  assert.equal(s[0].emp, 'kael');
  assert.equal(s[0].date_debut, dans(2));
  assert.equal(s[0].date_fin, dans(2));
  assert.equal(s[0].titre, 'Piscine Alpha');
  assert.equal(s[0].statut, 'assigne');
  assert.equal(s[0].recurrence, null, 'pas une série récurrente');
  v = await A(page, () => window.__admin.vals());
  assert.equal(v.woSuite.length, 2);
  assert.match(v.woSuite[1].l, /^Jour 2 · /);
  assert.ok(v.woSuite[1].canDel);

  // Même jour une 2e fois, ou le jour du bon : refusé
  await A(page, (d) => window.__admin.vals().onWoSuiteDate({ target: { value: d } }), dans(2));
  await A(page, () => window.__admin.vals().woProlonger());
  await toast(page, /déjà prévu le/);
  await A(page, (d) => window.__admin.vals().onWoSuiteDate({ target: { value: d } }), today());
  await A(page, () => window.__admin.vals().woProlonger());
  await toast(page, /déjà prévu le/);
  assert.equal(suites(db).length, 1);

  // Retirer la journée
  await A(page, () => window.__admin.vals().woSuite[1].del());
  await toast(page, /Journée retirée/);
  assert.equal(suites(db).length, 0);
  assert.equal((await A(page, () => window.__admin.vals())).woSuite.length, 1);
  assert.deepEqual(errors, []);
  await page.close();
});

test('le bon prolongé apparaît ces jours-là : Plan de Match, 4 semaines, diagramme (une seule barre, jusqu’au dernier jour)', async () => {
  const t = base();
  t.planning_tasks = [{ id: 'pt-s1', titre: 'Piscine Alpha', descr: 'Suite du bon de travail', emp: 'kael', site_nom: 'Piscine Alpha', wo_id: 'wo-mine', date_debut: dans(1), date_fin: dans(1), heure_debut: '', heure_fin: '', statut: 'assigne', recurrence: null },
    { id: 'pt-s2', titre: 'Piscine Alpha', descr: 'Suite du bon de travail', emp: 'kael', site_nom: 'Piscine Alpha', wo_id: 'wo-mine', date_debut: dans(3), date_fin: dans(3), heure_debut: '', heure_fin: '', statut: 'assigne', recurrence: null }];
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  // Plan de Match / travaux du jour du technicien
  const jobs = await page.waitForFunction((L) => { const a = window.__admin, r = L.map((d) => a.dayJobs('kael', d).filter((j) => j.id === 'wo-mine').map((j) => j.kind + ':' + j.k)); return r.every((x) => x.length) ? r : null; }, [today(), dans(1), dans(3)]).then((h) => h.jsonValue());
  assert.deepEqual(jobs, [['wo:Bon de travail'], ['wo:Bon de travail (suite)'], ['wo:Bon de travail (suite)']]);
  assert.deepEqual(await A(page, (d) => window.__admin.dayJobs('kael', d).filter((j) => j.id === 'wo-mine').length, dans(2)), 0, 'pas le jour entre les deux');

  // 4 semaines : le bon apparaît ses 3 journées, pas les jours entre ; un clic ouvre le bon
  await A(page, () => { window.__admin.go('planning'); window.__admin.setState({ pView: 'mois' }); });
  await page.waitForFunction(() => (window.__admin.vals().p2Weeks || []).length === 4);
  const n = await A(page, () => window.__admin.vals().p2Weeks.flatMap((w) => w.days).filter((d) => d.items.some((i) => /Piscine Alpha/.test(i.txt))).length);
  assert.equal(n, 3);
  // Diagramme : une seule barre pour le bon, du jour du bon au dernier jour prévu
  await A(page, () => window.__admin.setState({ pView: 'gantt' }));
  await page.waitForFunction(() => (window.__admin.vals().gRows || []).length > 0);
  const g = await A(page, () => window.__admin.vals().gRows.find((r) => r.label === 'Piscine Alpha'));
  assert.equal(g.bars.length, 1);
  assert.ok(g.bars[0].tip.startsWith(today() + ' → '), g.bars[0].tip);
  assert.deepEqual(errors, []);
  await page.close();
});

test('bon d’avant-hier prolongé à aujourd’hui : plus « en retard » ; techniciens suivis ; suppression du bon', async () => {
  const t = base();
  const wo = t.workorders.find((w) => w.id === 'wo-mine'); wo.date = dans(-2);
  t.planning_tasks = [{ id: 'pt-s1', titre: 'Piscine Alpha', descr: 'Suite du bon de travail', emp: 'kael', site_nom: 'Piscine Alpha', wo_id: 'wo-mine', date_debut: today(), date_fin: today(), heure_debut: '', heure_fin: '', statut: 'assigne', recurrence: null },
    { id: 'pt-autre', titre: 'Autre tâche', descr: '', emp: 'kael', site_nom: '', date_debut: today(), date_fin: today(), statut: 'assigne' }];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  assert.equal(await A(page, () => window.__admin.woFin(window.__admin.D.wo.find((w) => w.id === 'wo-mine'))), today());

  // Changer les techniciens du bon ne touche pas ses journées de plus (chaque journée a les siens)
  await ouvrirBon(page, 'wo-mine');
  await A(page, () => window.__admin.feSet('assignes', ['kael2']));
  await A(page, () => window.__admin.feSave());
  await toast(page, /Bon de travail enregistré/);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(db.rows('workorders').find((w) => w.id === 'wo-mine').assigne, 'kael2');
  assert.equal(suites(db)[0].emp, 'kael', 'la journée de plus garde son technicien');

  // Supprimer le bon : ses journées de plus partent avec lui, rien d'autre
  await ouvrirBon(page, 'wo-mine');
  await A(page, () => window.__admin.feDelete(1));
  await A(page, () => window.__admin.feDelete(1));
  await toast(page, /1 supprimé/);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(suites(db).length, 0);
  assert.ok(db.rows('planning_tasks').some((x) => x.id === 'pt-autre'));
  assert.deepEqual(errors, []);
  await page.close();
});

test('sa-terrain : la journée de plus montre le bon lui-même (tâches, notes) dans la tournée du jour', async () => {
  const t = base();
  const wo = t.workorders.find((w) => w.id === 'wo-mine');
  wo.date = dans(-2); wo.notes = 'Code de la porte : 1234'; wo.tasks = [{ id: 'a', label: 'Finir le joint', done: false }];
  t.planning_tasks = [{ id: 'pt-s1', titre: 'Piscine Alpha', descr: 'Suite du bon de travail', emp: 'kael', site_id: '1', site_nom: 'Piscine Alpha', wo_id: 'wo-mine', date_debut: today(), date_fin: dans(1), heure_debut: '13:00', heure_fin: '16:00', statut: 'assigne', recurrence: null }];
  const { page, errors } = await openApp(browser, srv.url, { app: 'terrain', user: TECH, tables: t });
  // syncAt est aussi posé par le chargement du référentiel : attendre la tournée elle-même
  await page.waitForFunction(() => window.__terrain && (window.__terrain.jobs || []).some((x) => x.id === 'wo:wo-mine'));
  const j = await A(page, () => window.__terrain.jobs.filter((x) => x.id === 'wo:wo-mine').map((x) => ({ date: x.date, rec: x.rec, quoi: x.todo.quoi, n: x.todo.tasks.length })));
  assert.deepEqual(j, [{ date: today(), rec: '', quoi: 'Bon de travail', n: 1 }], 'pas une « visite récurrente »');
  assert.deepEqual(await A(page, () => { const x = window.__terrain.jobs.find((y) => y.id === 'wo:wo-mine'); return [x.h, x.fin, x.tache]; }), ['13:00', '16:00', 'Suite · Entretien hebdo']);
  assert.equal(await A(page, () => window.__terrain.jobs.filter((x) => /^pt:/.test(x.id)).length), 0, 'pas en double comme « tâche planning »');
  const demain = await A(page, () => window.__terrain.days[1].items.length);
  assert.equal(demain, 1, 'aussi demain');
  await A(page, () => window.__terrain.open('wo:wo-mine'));
  await page.waitForTimeout(100);
  const txt = await page.locator('[data-todo]').innerText();
  assert.match(txt, /Finir le joint/);
  assert.match(txt, /Code de la porte : 1234/);
  assert.deepEqual(errors, []);
  await page.close();
});

test('chaque journée a ses techniciens et ses heures : retirer un employé d’une journée ne touche pas les autres', async () => {
  const t = base();
  const wo = t.workorders.find((w) => w.id === 'wo-mine'); wo.assigne = 'kael, kael2'; wo.assignes = ['kael', 'kael2'];
  const S = (id, d) => ({ id, titre: 'Piscine Alpha', descr: 'Suite du bon de travail', emp: 'kael, kael2', emp_nom: 'Kaël Test, Autre Tech', site_nom: 'Piscine Alpha', wo_id: 'wo-mine', date_debut: d, date_fin: d, heure_debut: '', heure_fin: '', statut: 'assigne', recurrence: null });
  t.planning_tasks = [S('pt-s1', dans(1)), S('pt-s2', dans(2))];
  const { page, db, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: t });
  await ouvrirBon(page, 'wo-mine');
  let v = await A(page, () => window.__admin.vals());
  assert.equal(v.woSuite.length, 3);
  assert.ok(!v.woSuite[0].edit, 'le jour du bon se règle avec les champs du bon');
  assert.deepEqual(v.woSuite[1].techs.filter((c) => c.on).map((c) => c.l), ['Kaël Test', 'Autre Tech']);
  // Retirer Autre Tech du jour 2 seulement
  await A(page, () => window.__admin.vals().woSuite[1].techs.find((c) => c.l === 'Autre Tech').go());
  await toast(page, /Retiré le .* seulement : Autre Tech/);
  const row = (id) => db.rows('planning_tasks').find((x) => x.id === id);
  assert.equal(row('pt-s1').emp, 'kael');
  assert.equal(row('pt-s1').emp_nom, 'Kaël Test');
  assert.equal(row('pt-s2').emp, 'kael, kael2', 'jour 3 inchangé');
  assert.equal(db.rows('workorders').find((w) => w.id === 'wo-mine').assigne, 'kael, kael2', 'le bon inchangé');
  // Heures du jour 3
  await A(page, () => window.__admin.vals().woSuite[2].onHD({ target: { value: '08:00' } }));
  await toast(page, /Heure enregistrée/);
  await A(page, () => window.__admin.vals().woSuite[2].onHF({ target: { value: '07:00' } }));
  await toast(page, /fin doit suivre/);
  await A(page, () => window.__admin.vals().woSuite[2].onHF({ target: { value: '12:00' } }));
  await page.waitForFunction(() => window.__admin.state.fe.suite.find((x) => x.id === 'pt-s2').heure_fin === '12:00');
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(row('pt-s2').heure_debut, '08:00');
  assert.equal(row('pt-s2').heure_fin, '12:00');
  assert.equal(row('pt-s1').heure_debut, '');
  // Les affichages suivent la journée : Autre Tech n'a plus le bon le jour 2, l'heure apparaît le jour 3
  const r = await page.waitForFunction((L) => { const a = window.__admin, f = (u, d) => a.dayJobs(u, d).filter((j) => j.id === 'wo-mine').map((j) => j.h + '|' + j.k);
    const x = [f('kael2', L[0]), f('kael', L[0]), f('kael2', L[1])]; return x[1].length && x[2].length ? x : null; }, [dans(1), dans(2)]).then((h) => h.jsonValue());
  assert.deepEqual(r, [[], ['|Bon de travail (suite)'], ['08:00|Bon de travail (suite)']]);
  // Prolonger avec des heures
  await A(page, (d) => { const v = window.__admin.vals(); v.onWoSuiteDate({ target: { value: d } }); }, dans(4));
  await A(page, () => window.__admin.vals().onWoSuiteHD({ target: { value: '09:30' } }));
  await A(page, () => window.__admin.vals().onWoSuiteHF({ target: { value: '15:00' } }));
  await A(page, () => window.__admin.vals().woProlonger());
  await toast(page, /Bon de travail prolongé/);
  const n = suites(db).find((x) => x.date_debut === dans(4));
  assert.equal(n.heure_debut, '09:30');
  assert.equal(n.heure_fin, '15:00');
  assert.deepEqual(errors, []);
  await page.close();
});
