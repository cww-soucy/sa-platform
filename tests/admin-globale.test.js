'use strict';
// sa-admin — Vue globale : chiffres clés, charge sur 4 semaines, alertes, 7 prochains jours, file « terminé → à valider ».
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, today, iso, addDays } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

const A = (page, fn, arg) => page.evaluate(fn, arg);
const toast = (page, re) => page.waitForFunction((s) => new RegExp(s).test(window.__admin.state.toast || ''), re.source);
const monday = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };

function tables() {
  const t = base(), mon = monday();
  // bon de travail écrit par SA Platform : NOMS dans assigne, identifiants dans assignes
  t.workorders.push({ id: 'wo-late', client: 'Club Gamma', site: '', type: 'reparation', priorite: 'normal', status: 'ouvert', date: iso(addDays(new Date(), -3)), assigne: 'Kaël Test', assignes: ['kael'], descr: 'Pompe' });
  t.workorders.push({ id: 'wo-fini', client: 'Piscine Delta', site: '', type: 'entretien', priorite: 'normal', status: 'ouvert', date: today(), assigne: 'kael', descr: 'Vidange', termine: true, termine_by: 'kael', termine_at: new Date().toISOString(), updated_at: '2026-10-01T10:00:00Z' });
  t.plan.push({ id: 'pl-fini', client: 'Piscine Beta', date: today(), heure: '09:00', emp: 'Autre Tech', emps: ['kael2'], status: 'assigned', termine: true, termine_by: 'kael2', termine_at: new Date().toISOString(), updated_at: '2026-10-01T11:00:00Z' });
  t.planning_tasks.push({ id: 'pt-vac', titre: 'Vacances', emp: 'kael2', emp_nom: 'Autre Tech', date_debut: iso(mon), date_fin: iso(addDays(mon, 4)), statut: 'assigne' });
  t.planning_tasks.push({ id: 'pt-next', titre: 'Ouverture saison', emp: 'kael', site_nom: 'Piscine Alpha', date_debut: iso(addDays(new Date(), 2)), date_fin: iso(addDays(new Date(), 2)), heure_debut: '08:00', statut: 'assigne' });
  t.inventaire[0].seuil = 15;
  return t;
}
async function open(page) {
  await page.waitForFunction(() => window.__admin && window.__admin.D);
  await A(page, () => window.__admin.go('globale'));
  await page.getByText('Terminé par l’équipe — à valider').waitFor();
}

test('vue globale : chiffres, charge (absence), alertes et 7 prochains jours', async () => {
  const { page, errors } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await open(page);
  const v = await A(page, () => { const x = window.__admin.vals(); return { k: x.gKpis, ch: x.gCharge, al: x.gAlerts.map((a) => a.t), nx: x.gNext.map((n) => n.nom + '|' + n.qui) }; });
  const K = Object.fromEntries(v.k.map((k) => [k.l, k.v]));
  assert.equal(K['Bons de travail ouverts'], 4);
  assert.equal(K['En retard'], 1);
  assert.equal(K['À valider'], 2);
  assert.equal(K['Absences en cours'], new Date().getDay() % 6 === 0 ? 0 : 1);
  const autre = v.ch.find((c) => c.nom === 'Autre Tech');
  assert.equal(autre.cells[0].txt, 'Absent');
  assert.equal(autre.cells.length, 4);
  assert.ok(!v.ch.some((c) => c.nom === 'Bureau SA'), 'le compte admin n’est pas un technicien');
  assert.ok(v.al.includes('Club Gamma — bon de travail en retard'));
  assert.ok(v.al.includes('2 élément(s) terminé(s) à valider'));
  assert.ok(v.al.includes('1 punch(s) à valider'));
  assert.ok(v.al.includes('1 produit(s) sous le seuil'));
  assert.ok(v.nx.includes('Ouverture saison|Kaël Test'));
  assert.ok(!v.nx.some((n) => /Vacances/.test(n)), 'une absence n’est pas un travail');
  await page.getByText('Club Gamma — bon de travail en retard').waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('vue globale : valider un bon terminé (écriture conditionnelle) — rien d’écrasé si modifié entre-temps', async () => {
  const { page, db } = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await open(page);
  await page.getByRole('row', { name: /Piscine Delta/ }).getByRole('button', { name: 'Valider' }).click();
  await toast(page, /Validé : Piscine Delta/);
  const w = db.rows('workorders').find((x) => x.id === 'wo-fini');
  assert.equal(w.valide, true);
  assert.equal(w.valide_by, 'cwweil');
  assert.ok(w.valide_at);
  assert.ok(db.rows('audit_log').some((a) => a.action === 'VALIDATION' && a.ressource === 'workorders'));
  await page.waitForFunction(() => { const x = window.__admin.vals(); return x.gReady && !x.gQueue.some((r) => r.nom === 'Piscine Delta'); });
  // l'employé retouche le créneau pendant que la page est ouverte
  db.rows('plan').find((x) => x.id === 'pl-fini').updated_at = '2026-10-02T15:00:00Z';
  await page.getByRole('row', { name: /Piscine Beta/ }).getByRole('button', { name: 'Valider' }).click();
  await toast(page, /vient d’être modifié ailleurs/);
  assert.notEqual(db.rows('plan').find((x) => x.id === 'pl-fini').valide, true);
  await page.close();
});
