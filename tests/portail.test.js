'use strict';
// Portail client (portail/?q=JETON) : QR → identifiant → code à usage unique → installation, sous la CSP de _headers.
// La fonction serveur est simulée ici ; sa logique (droits, filtrage) est testée dans portail-fonction.test.js.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { startServer, launch, iso, addDays } = require('./harness');

const FN = 'https://ldqvdiaewvhnukuaxdmc.supabase.co/functions/v1/portail';
let browser, srv, L;
before(async () => { browser = await launch(); srv = await startServer(); L = await import(path.join(__dirname, '..', 'supabase', 'functions', 'portail', 'lib.js')); });
after(async () => { await browser.close(); srv.close(); });

const HEADERS = (() => {
  const src = require('fs').readFileSync(path.join(__dirname, '..', '_headers'), 'utf8');
  const block = src.split('\n/portail/*\n')[1].split(/\n\s*\n/)[0];
  return Object.fromEntries(block.split('\n').map((l) => l.trim().match(/^([\w-]+):\s*(.+)$/)).filter(Boolean).map((m) => [m[1].toLowerCase(), m[2]]));
})();
const PH = { key: 'ph', label: 'pH', unit: '', kind: 'range', min: 6.8, max: 8.2, lo: 7.2, hi: 7.6, step: 0.1 };
const CL = { key: 'cl', label: 'Chlore libre', unit: 'mg/L', kind: 'range', min: 0, max: 5, lo: 1, hi: 3, step: 0.1 };

function serveur(niveau) {
  const hier = iso(addDays(new Date(), -1));
  const src = {
    sites: [{ id: '1', nom: 'Piscine Alpha', addr: '1 rue A', bassins: [{ id: 'b1', nom: 'Grand bassin' }, { id: 'b2', nom: 'Pataugeoire' }] }],
    types: { MI: { label: 'Piscine municipale intérieure', fields: [PH, CL], checks: ['Registre RQEP signé', 'Parois et fond brossés'] } },
    catalogue: [],
    releves: [{ id: 'r1', site_id: '1', bassin: 'Grand bassin', date: hier, heure: '10:00', type_code: 'MI', vals: { ph: 7.9, cl: 2 }, touched: { ph: true, cl: true }, statut: 'publiee',
      points: { 'MI-0': { etat: 'action', note: 'Registre absent' }, 'MI-1': { etat: 'ok' } }, resume: 'interne', tech_nom: 'Kaël Test' }],
    workorders: [{ site: 'Piscine Alpha', date: iso(new Date()), type: 'réparation', status: 'ouvert' }],
    documents: [],
  };
  const st = { codes: [], sessions: new Set(), calls: [] };
  const handler = async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'), tok = route.request().headers()['x-portail-session'];
    st.calls.push(b.action);
    const ok = (o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (b.action === 'qr') return ok(b.jeton === 'BON' ? { ok: true, site: 'Piscine Alpha', bassin: 'Grand bassin', code: 'SA-S01-B1', carnet: '../qr-carnet/?site=1' } : { ok: false, desactive: true });
    if (b.action === 'demander_code') { st.codes.push(b.identifiant); return ok({ ok: true, masque: L.masquer(b.identifiant), minutes: 10 }); }
    if (b.action === 'verifier_code') { if (b.code !== '123456') return ok({ ok: false, message: 'Code incorrect ou expiré.' }); st.sessions.add('S-' + st.sessions.size + '-xxxxxxxxxxxxxxxxxxxx'); return ok({ ok: true, session: [...st.sessions].pop(), jours: b.souvenir ? 90 : 0 }); }
    if (b.action === 'donnees') {
      if (!st.sessions.has(tok)) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"ok":false}' });
      return ok({ ok: true, contact: { nom: 'Jeanne Gestion', niveau }, compte: { nom: 'Ville de Test', logo: null }, urgence: '418-555-0100', contrats: { 1: 'MI' },
        ...L.donneesClient(src, { niveau, sitesOk: ['1'] }) });
    }
    if (b.action === 'deconnexion') return ok({ ok: true });
    return ok({ ok: false });
  };
  return { st, handler };
}

async function open(query, niveau = 'gestionnaire') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], { st, handler } = serveur(niveau);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.exposeFunction('__csp', (v) => errors.push('csp: ' + v));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.__csp(e.violatedDirective + ' ' + e.blockedURI)));
  await page.route(FN, handler);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route(/\/portail\//, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, headers: { ...res.headers(), ...HEADERS } }); });
  await page.goto(srv.url + '/portail/' + query);
  return { page, st, errors };
}

test('portail : QR → courriel → code → installation (gestionnaire), sans violation de CSP', async () => {
  const { page, st, errors } = await open('?q=BON');
  await page.getByText('Piscine Alpha').first().waitFor();
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.fill('#ident', 'jeanne@ville.qc.ca');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await page.getByText('j•••••@ville.qc.ca').waitFor();
  for (const [i, d] of [...'000000'].entries()) await page.getByLabel('Chiffre ' + (i + 1)).fill(d);
  await page.getByRole('button', { name: 'Accéder' }).click();
  await page.getByText('Code incorrect ou expiré.').waitFor();
  for (const [i, d] of [...'123456'].entries()) await page.getByLabel('Chiffre ' + (i + 1)).fill(d);
  await page.getByRole('button', { name: 'Accéder' }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
  const txt = await page.textContent('main');
  assert.match(txt, /3 interventions en cours/, '2 points en action + 1 bon de travail ouvert');
  assert.match(txt, /À votre attention/);
  assert.match(txt, /Registre RQEP signé — Registre absent/);
  assert.match(txt, /Gestionnaire/);
  assert.doesNotMatch(txt, /interne/, 'le résumé interne du technicien n’est jamais affiché');
  // relevé hors zone en plein, registre du mois
  assert.equal(await page.locator('td.out').first().textContent(), '7,9');
  await page.getByRole('tab', { name: 'Rapports' }).click();
  await page.locator('article p', { hasText: 'Intervention en cours : pH et Registre RQEP signé' }).waitFor();
  assert.deepEqual(st.codes, ['jeanne@ville.qc.ca']);
  assert.ok(await page.evaluate(() => sessionStorage.getItem('sa_portail_session')), 'session courte (pas « se souvenir »)');
  assert.deepEqual(errors, []);
  await page.close();
});

test('portail : niveau Opérateur — historique et rapports réservés, demande d’accès affichée', async () => {
  const { page } = await open('?q=BON', 'operateur');
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.fill('#ident', '819 555-1234');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  await page.getByText('•••-•••-1234').waitFor();
  for (const [i, d] of [...'123456'].entries()) await page.getByLabel('Chiffre ' + (i + 1)).fill(d);
  await page.getByLabel('Se souvenir de cet appareil 90 jours').check();
  await page.getByRole('button', { name: 'Accéder' }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
  await page.getByRole('tab', { name: 'Historique' }).click();
  await page.getByText('Historique : accès Gestionnaire.').waitFor();
  assert.doesNotMatch(await page.textContent('main'), /Registre absent/, 'notes du technicien : niveau rapports seulement');
  assert.ok(await page.evaluate(() => localStorage.getItem('sa_portail_session')), 'appareil retenu 90 jours');
  await page.close();
});

test('portail : QR révoqué → « Lien désactivé »', async () => {
  const { page, errors } = await open('?q=VIEUX');
  await page.getByText('Lien désactivé').waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});
