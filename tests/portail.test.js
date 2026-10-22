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

function serveur(niveau, sitesOk = ['1'], multi = false) {
  const hier = iso(addDays(new Date(), -1));
  const src = {
    sites: [{ id: '1', nom: 'Piscine Alpha', addr: '1 rue A', bassins: [{ id: 'b1', nom: 'Grand bassin' }, { id: 'b2', nom: 'Pataugeoire' }] },
      { id: '2', nom: 'Piscine Beta', addr: '2 rue B', bassins: [{ id: 'b3', nom: 'Bassin Beta' }] }],
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
    const QR = { BETA: ['2', 'Piscine Beta'], AUTRE: ['9', 'Piscine Gamma'] };
    if (b.action === 'qr' && QR[b.jeton]) return ok({ ok: true, site_id: QR[b.jeton][0], site: QR[b.jeton][1], bassin: '', code: 'SA', carnet: '../qr-carnet/?site=' + QR[b.jeton][0] });
    if (b.action === 'qr') return ok(b.jeton === 'BON' ? { ok: true, site_id: '1', site: 'Piscine Alpha', bassin: 'Grand bassin', code: 'SA-S01-B1', carnet: '../qr-carnet/?site=1' } : { ok: false, desactive: true });
    if (b.action === 'demander_code') { st.codes.push(b.identifiant); return ok({ ok: true, masque: L.masquer(b.identifiant), minutes: 10 }); }
    if (b.action === 'verifier_code') { if (b.code !== '123456') return ok({ ok: false, message: 'Code incorrect ou expiré.' }); st.sessions.add('S-' + st.sessions.size + '-xxxxxxxxxxxxxxxxxxxx'); return ok({ ok: true, session: [...st.sessions].pop(), jours: b.souvenir ? 90 : 0 }); }
    if (b.action === 'donnees') {
      if (!st.sessions.has(tok)) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"ok":false}' });
      st.donnees = (st.donnees || []).concat([b.site || null]);
      if (multi) { // même adresse inscrite dans deux comptes : Piscine Alpha (Ville de Test) et Piscine Beta (Autre client)
        const installations = [{ id: '1', nom: 'Piscine Alpha', compte: 'Ville de Test' }, { id: '2', nom: 'Piscine Beta', compte: 'Autre client' }];
        if (!b.site) return ok({ ok: true, choisir: true, contact: { nom: 'Jeanne Gestion' }, installations });
        return ok({ ok: true, contact: { nom: 'Jeanne Gestion', niveau }, compte: { nom: b.site === '2' ? 'Autre client' : 'Ville de Test', logo: null }, urgence: '', contrats: { 1: 'MI' }, installations,
          ...L.donneesClient({ ...src, sites: src.sites.filter((x) => x.id === b.site) }, { niveau, sitesOk: [b.site] }) });
      }
      return ok({ ok: true, contact: { nom: 'Jeanne Gestion', niveau }, compte: { nom: 'Ville de Test', logo: null }, urgence: '418-555-0100', contrats: { 1: 'MI' },
        ...L.donneesClient({ ...src, sites: src.sites.filter((x) => sitesOk.includes(x.id)) }, { niveau, sitesOk }) });
    }
    if (b.action === 'admin_ouvrir') return ok(b.id === 'cwweil' && b.mdp === 'bon' ? { ok: true, session: 'ADM-xxxxxxxxxxxxxxxxxxxxxxxx', role: 'admin' } : { ok: false, message: 'Identifiant ou mot de passe incorrect, ou rôle insuffisant.' });
    if (b.action === 'admin_apercu') {
      if (tok !== 'ADM-xxxxxxxxxxxxxxxxxxxxxxxx') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"ok":false}' });
      st.apercu = b;
      return ok({ ok: true, apercu: true, contact: { nom: 'Aperçu', niveau: b.niveau }, compte: { nom: 'Aperçu', logo: null }, urgence: '', contrats: { 1: 'MI' },
        ...L.donneesClient({ ...src, sites: src.sites.filter((x) => x.id === b.site_id) }, { niveau: b.niveau, sitesOk: [b.site_id] }) });
    }
    if (b.action === 'deconnexion') return ok({ ok: true });
    return ok({ ok: false });
  };
  return { st, handler };
}

async function open(query, niveau = 'gestionnaire', sitesOk, multi) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], { st, handler } = serveur(niveau, sitesOk, multi);
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

async function connexion(page) {
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.fill('#ident', 'jeanne@ville.qc.ca');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  for (const [i, d] of [...'123456'].entries()) await page.getByLabel('Chiffre ' + (i + 1)).fill(d);
  await page.getByRole('button', { name: 'Accéder' }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
}

test('portail : le QR scanné ouvre son installation, pas la première du compte', async () => {
  const { page } = await open('?q=BETA', 'gestionnaire', ['1', '2']);
  await connexion(page);
  assert.equal(await page.textContent('h1'), 'Piscine Beta');
  assert.equal(await page.getByRole('alert').count(), 0);
  // déjà connecté : un autre QR du même compte montre d'abord le choix, puis ouvre le bon site sans redemander de code
  await page.goto(srv.url + '/portail/?q=BON');
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Alpha');
  await page.close();
});

test('portail : QR d’une installation hors de l’accès — n’ouvre pas une autre installation (Canotier → Aula)', async () => {
  const { page, errors } = await open('?q=AUTRE');
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.fill('#ident', 'jeanne@ville.qc.ca');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  for (const [i, d] of [...'123456'].entries()) await page.getByLabel('Chiffre ' + (i + 1)).fill(d);
  await page.getByRole('button', { name: 'Accéder' }).click();
  // l'adresse n'est inscrite que pour Piscine Alpha : on reste sur Piscine Gamma, le portail d'Alpha ne s'ouvre pas tout seul
  await page.getByText('Votre adresse est inscrite pour Piscine Alpha, pas pour Piscine Gamma.', { exact: false }).waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Gamma');
  assert.equal(await page.locator('.opere').count(), 0);
  assert.equal(await page.inputValue('#ident'), '', 'l’adresse précédente n’est pas reproposée');
  // personnel Soucy Aquatik : fiche du site scanné
  await page.getByRole('button', { name: 'Personnel Soucy Aquatik' }).click();
  await page.getByRole('button', { name: 'Ouvrir la fiche du site' }).waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Gamma');
  await page.getByRole('button', { name: 'Retour' }).click();
  // ses propres installations restent à un clic, sur demande
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.getByRole('button', { name: 'Continuer vers Piscine Alpha' }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Alpha');
  assert.deepEqual(errors, []);
  await page.close();
});

test('portail : QR avec une session client gardée — le choix client / technicien reste proposé', async () => {
  const { page, errors } = await open('?q=BON');
  await connexion(page); // session client gardée pour Piscine Alpha seulement
  // le même téléphone scanne le QR d'un autre site : choix d'abord, pas le portail du client déjà connecté
  await page.goto(srv.url + '/portail/?q=BETA');
  await page.getByRole('heading', { name: 'Piscine Beta' }).waitFor();
  const tech = page.getByRole('link', { name: 'Je suis technicien' });
  assert.equal(new URL(await tech.getAttribute('href'), page.url()).pathname + new URL(await tech.getAttribute('href'), page.url()).search, '/terrain.html?site=2');
  assert.equal(await page.getByRole('link', { name: /Carnet de bord/ }).getAttribute('href'), '../qr-carnet/?site=2');
  // « Accès client » : la session gardée ne donne pas accès à Piscine Beta → on demande l'adresse de CETTE installation
  await page.getByRole('button', { name: 'Accès client' }).click();
  await page.getByText('Votre adresse est inscrite pour Piscine Alpha, pas pour Piscine Beta. Pour cette installation, entrez le courriel ou cellulaire inscrit par son gestionnaire.').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Beta');
  await page.locator('#ident').waitFor();
  assert.equal(await page.locator('.opere').count(), 0, 'le portail du client déjà connecté ne s’ouvre pas');
  // ses propres installations restent à un clic
  await page.getByRole('button', { name: 'Continuer vers Piscine Alpha' }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Alpha');
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.deepEqual(errors, []);
  await page.close();
});

test('portail : QR → « Personnel Soucy Aquatik » → fiche complète du site scanné, même avec une session client gardée', async () => {
  const { page, st, errors } = await open('?q=BON');
  await connexion(page); // session client gardée pour Piscine Alpha seulement
  await page.goto(srv.url + '/portail/?q=BETA');
  await page.getByRole('button', { name: 'Personnel Soucy Aquatik' }).click();
  await page.getByLabel('Identifiant').fill('cwweil');
  await page.getByLabel('Mot de passe').fill('mauvais');
  await page.getByRole('button', { name: 'Ouvrir la fiche du site' }).click();
  await page.getByText('Identifiant ou mot de passe incorrect, ou rôle insuffisant.').waitFor();
  await page.getByLabel('Mot de passe').fill('bon');
  await page.getByRole('button', { name: 'Ouvrir la fiche du site' }).click();
  await page.waitForURL(/apercu=1&site=2&niveau=direction/);
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Beta');
  assert.equal(st.apercu.site_id, '2');
  // session gardée 11 h 30 : un autre QR ouvre directement la fiche, sans redemander le mot de passe
  await page.goto(srv.url + '/portail/?q=BON');
  await page.getByRole('button', { name: 'Personnel Soucy Aquatik' }).click();
  await page.waitForURL(/apercu=1&site=1/);
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Alpha');
  assert.deepEqual(errors, []);
  await page.close();
});

async function code(page) {
  await page.fill('#ident', 'jeanne@ville.qc.ca');
  await page.getByRole('button', { name: 'Recevoir un code' }).click();
  for (const [i, d] of [...'123456'].entries()) await page.getByLabel('Chiffre ' + (i + 1)).fill(d);
  await page.getByRole('button', { name: 'Accéder' }).click();
}

test('portail : adresse inscrite dans plusieurs comptes — on choisit l’installation, puis on passe de l’une à l’autre', async () => {
  const { page, st, errors } = await open('', 'gestionnaire', undefined, true);
  await code(page);
  await page.getByRole('heading', { name: 'Quelle installation ?' }).waitFor();
  assert.equal(await page.locator('.opere').count(), 0, 'aucune installation ouverte d’office');
  await page.getByRole('button', { name: /Piscine Beta/ }).click();
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Beta');
  // le sélecteur liste les installations des deux comptes ; changer de compte recharge avec ses droits
  await page.getByLabel('Mes installations').selectOption('1');
  await page.waitForFunction(() => document.querySelector('h1') && document.querySelector('h1').textContent === 'Piscine Alpha');
  assert.deepEqual(st.donnees, [null, '2', '1']);
  assert.deepEqual(errors, []);
  await page.close();
});

test('portail : adresse inscrite dans plusieurs comptes — le QR ouvre directement son installation', async () => {
  const { page, st, errors } = await open('?q=BETA', 'gestionnaire', undefined, true);
  await page.getByRole('button', { name: 'Accès client' }).click();
  await code(page);
  await page.locator('.opere').getByText('Opéré par').waitFor();
  assert.equal(await page.textContent('h1'), 'Piscine Beta');
  assert.equal(await page.getByRole('heading', { name: 'Quelle installation ?' }).count(), 0);
  assert.deepEqual(st.donnees, ['2']);
  assert.deepEqual(errors, []);
  await page.close();
});
