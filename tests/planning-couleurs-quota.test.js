'use strict';
// Planning équipe : une couleur par employé, heures restantes sur un quota de 40 h, impression aux couleurs de Soucy Aquatik (12/11/2026).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, openApp, launch, iso } = require('./harness');
const { base } = require('./fixtures');

const ADMIN = { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin' };
let browser, srv;
before(async () => { browser = await launch(); srv = await startServer(); });
after(async () => { await browser.close(); srv.close(); });

function tables() {
  const t = base();
  const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const d = (i) => { const x = new Date(mon); x.setDate(x.getDate() + i); return iso(x); };
  // Kaël : 3 journées de 8 h (24 h) ; Autre Tech : 5 journées de 9 h (45 h)
  t.workorders = [0, 1, 2].map((i) => ({ id: 'k' + i, client: 'Piscine Alpha', site: '1 rue A, Québec', type: 'entretien', priorite: 'normal', status: 'ouvert', date: d(i), heure_debut: '08:00', heure_fin: '16:00', assigne: 'kael', descr: '', groupe_id: null }))
    .concat([0, 1, 2, 3, 4].map((i) => ({ id: 'a' + i, client: 'Piscine Beta', site: '2 rue B, Lévis', type: 'reparation', priorite: 'normal', status: 'ouvert', date: d(i), heure_debut: '07:00', heure_fin: '16:00', assigne: 'kael2', descr: '', groupe_id: null })));
  t.plan = [];
  return t;
}

async function ouvrir() {
  const r = await openApp(browser, srv.url, { app: 'admin', user: ADMIN, tables: tables() });
  await r.page.waitForFunction(() => window.__admin && window.__admin.D);
  await r.page.evaluate(() => window.__admin.go('planning'));
  await r.page.waitForFunction(() => (window.__admin.vals().planRows || []).some((x) => x.nom === 'Kaël Test' && x.cells.some((c) => c.slots.length)));
  return r;
}
const ligne = (page, nom) => page.evaluate((n) => { const r = window.__admin.vals().planRows.find((x) => x.nom === n); return { col: r.col, tete: r.tete, reste: r.reste, pct: r.pct, slotCols: [].concat(...r.cells.map((c) => c.slots.map((s) => s.col))) }; }, nom);

test('planning : chaque employé a sa propre couleur, reprise sur ses travaux', async () => {
  const { page, errors } = await ouvrir();
  const k = await ligne(page, 'Kaël Test'), a = await ligne(page, 'Autre Tech');
  assert.match(k.col, /^hsl\(/);
  assert.notEqual(k.col, a.col);
  assert.ok(k.slotCols.length === 3 && k.slotCols.every((c) => c === k.col));
  assert.ok(a.slotCols.every((c) => c === a.col));
  // la même couleur dans 4 semaines et le diagramme
  const gantt = await page.evaluate(() => { window.__admin.setState({ pView: 'gantt' }); return new Promise((ok) => setTimeout(() => ok((window.__admin.vals().gRows || []).map((r) => r.bars[0] && r.bars[0].bg)), 500)); });
  assert.ok(gantt.includes(k.col) && gantt.includes(a.col), gantt.join(' | '));
  assert.deepEqual(errors, []);
  await page.close();
});

test('planning : heures restantes à combler sur un quota de 40 h', async () => {
  const { page, errors } = await ouvrir();
  const k = await ligne(page, 'Kaël Test'), a = await ligne(page, 'Autre Tech');
  assert.equal(k.reste, '16 h 00 à combler sur 40 h');
  assert.equal(k.pct, 60);
  assert.equal(a.reste, 'Quota atteint · +5 h 00');
  assert.equal(a.pct, 100);
  await page.locator('[data-quota]', { hasText: '16 h 00 à combler sur 40 h' }).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('planning : la semaine et le diagramme s’impriment avec le logo, le bandeau et les couleurs de Soucy Aquatik', async () => {
  const { page, errors } = await ouvrir();
  const html = await page.evaluate(() => {
    const out = []; window.open = () => ({ document: { write: (h) => out.push(h), close() {} } });
    window.__admin.vals().pPrint();
    window.__admin.setState({ pView: 'gantt' });
    return new Promise((ok) => setTimeout(() => { window.__admin.vals().gPrint(); ok(out); }, 500));
  });
  assert.equal(html.length, 2);
  const k = await ligne(page, 'Kaël Test');
  for (const h of html) {
    assert.match(h, /class="da-tete"/);
    assert.match(h, /<img src="data:image\/png;base64,/);
    assert.match(h, /Barlow Condensed/);
    assert.match(h, /#1B4F8C/);
  }
  assert.match(html[0], /Planning équipe/);
  assert.ok(html[0].includes(k.col), 'couleur de Kaël dans l’impression');
  assert.match(html[0], /16 h 00 à combler sur 40 h/);
  assert.match(html[1], /Diagramme des travaux/);
  assert.deepEqual(errors, []);
  await page.close();
});
