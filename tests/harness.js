// Banc d'essai commun : sert les fichiers générés en HTTP (comme Cloudflare Pages, pas en file://)
// et remplace Supabase par une petite base en mémoire qui comprend le sous-ensemble de PostgREST utilisé.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SB = 'https://ldqvdiaewvhnukuaxdmc.supabase.co';
const SCHEMA = require('./schema.json');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6364f8cf00000301010018dd8db40000000049454e44ae426082', 'hex');

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mondayOf(d) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const today = () => iso(new Date());
const weekKey = () => iso(mondayOf(new Date()));
const dayIdx = () => (new Date().getDay() + 6) % 7;

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (p.endsWith(path.sep)) p = path.join(p, 'index.html'); // dossier/ → dossier/index.html, comme Cloudflare Pages
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      // .js en text/javascript : obligatoire pour les modules ES (<script type="module">, import)
      res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'text/javascript; charset=utf-8' : p.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream' });
      res.end(fs.readFileSync(p));
    }).listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() }));
  });
}

/* Filtres PostgREST pris en charge : col=eq.x, col=neq.x, col=is.null, col=not.is.null (aussi sur col->>clé JSON). Les autres (gte, lte, ilike, order, limit…) sont
   ignorés volontairement : la fausse base renvoie alors PLUS que le vrai serveur, ce qui teste le filtrage côté app. */
function filters(qs) {
  const out = [];
  for (const [k, v] of new URLSearchParams(qs)) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    // col->>clé : champ d'un objet JSON (ex. recurrence->>serie)
    const get = k.includes('->>') ? ((a, b) => (r) => (r[a] == null ? undefined : r[a][b]))(...k.split('->>')) : (r) => r[k];
    if (v.startsWith('eq.')) out.push((r) => String(get(r)) === v.slice(3));
    else if (v === 'is.null') out.push((r) => get(r) == null);
    else if (v === 'not.is.null') out.push((r) => get(r) != null);
    else if (v.startsWith('neq.')) out.push((r) => String(get(r)) !== v.slice(4));
  }
  return (r) => out.every((f) => f(r));
}

class FakeDB {
  constructor(tables) {
    this.t = JSON.parse(JSON.stringify(tables || {})); this.log = []; this.fail = {}; this.rpc = {};
    // Jetons de session (Supabase Auth) : comme après SECURISATION_ETAPE3.sql, une table n'est servie qu'avec un jeton valide.
    this.jetons = new Set(); this.renouv = new Set(); this.sansJeton = []; this.n = 0; this.authLog = []; this.refusAuth = false;
    // carnet QR : nom d'un site par la fonction publique carnet_site_nom (null si inconnu)
    this.rpc.carnet_site_nom = (b) => { const x = this.rows('sites').find((r) => String(r.id) === String(b.p_site)); return x ? x.nom : null; };
  }
  emettre(id) {
    const n = ++this.n, c = this.rows('comptes').find((x) => x.id === id) || {};
    const j = { access_token: 'jeton-' + id + '-' + n, refresh_token: 'renouv-' + id + '-' + n, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: '00000000-0000-4000-8000-' + String(n).padStart(12, '0'), aud: 'authenticated', role: 'authenticated', email: id + '@comptes.soucyaquatik.local',
        app_metadata: { provider: 'email', compte_id: id, app_role: c.role || 'employe' }, user_metadata: {} } };
    this.jetons.add(j.access_token); this.renouv.add(j.refresh_token); return j;
  }
  async handleAuth(route, u) {
    const req = route.request(), body = req.postData() ? JSON.parse(req.postData()) : {}, grant = u.searchParams.get('grant_type');
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    this.authLog.push({ path: u.pathname, grant, body });
    if (this.fail.auth === 'network') return route.abort('failed');
    if (u.pathname.endsWith('/logout')) return route.fulfill({ status: 204, body: '' });
    if (grant === 'password') {
      if (this.refusAuth) return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return json(200, this.emettre(String(body.email).split('@')[0]));
    }
    if (grant === 'refresh_token' && this.renouv.has(body.refresh_token)) { this.renouv.delete(body.refresh_token); return json(200, this.emettre(body.refresh_token.split('-')[1])); }
    return json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
  }
  rows(name) { return (this.t[name] = this.t[name] || []); }
  async handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (u.pathname.startsWith('/auth/v1/')) return this.handleAuth(route, u);
    const name = u.pathname.replace('/rest/v1/', '');
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    this.log.push({ method: m, table: name, query: u.search, body });
    // Sans jeton valide : seulement ce qui reste public (connexion, carnet QR, sondages clients)
    const pub = /^rpc\/(verifier_connexion|changer_mdp|carnet_site_nom|sondage_stats|sondages_liste|sondage_enregistrer)$/.test(name)
      || (name === 'water_logs' && (m === 'GET' || m === 'POST')) || (name === 'sondages' && m === 'GET') || (name === 'sondage_reponses' && m === 'POST');
    const jeton = (req.headers()['authorization'] || '').replace(/^Bearer /, '');
    if (!pub && this.exigeJeton !== false && !this.jetons.has(jeton)) { this.sansJeton.push(m + ' ' + name); return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST301', message: 'jeton absent ou expiré' }) }); }
    const f = this.fail[name];
    if (f === 'network') return route.abort('failed');
    if (f) return route.fulfill({ status: f, contentType: 'application/json', body: JSON.stringify({ message: 'échec simulé' }) });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (name.startsWith('rpc/')) { const fn = this.rpc[name.slice(4)]; if (!fn) return json(200, []); try { return json(200, fn(body, this)); } catch (e) { return json(400, { message: e.message }); } }
    // Comme PostgREST : une écriture qui cite une colonne inexistante est refusée en entier (400).
    if ((m === 'POST' || m === 'PATCH') && SCHEMA[name] && body) {
      const bad = [].concat(body).flatMap((r) => Object.keys(r)).filter((k) => !SCHEMA[name].includes(k));
      if (bad.length) { this.log[this.log.length - 1].rejected = bad; return json(400, { code: 'PGRST204', message: 'colonne inconnue : ' + bad.join(', ') }); }
    }
    const match = filters(u.search);
    if (m === 'GET') return json(200, this.rows(name).filter(match));
    if (m === 'PATCH') { const hit = this.rows(name).filter(match); hit.forEach((r) => Object.assign(r, body)); return json(200, hit); }
    if (m === 'DELETE') { const all = this.rows(name), hit = all.filter(match); this.t[name] = all.filter((r) => !hit.includes(r)); return json(200, hit); }
    if (m === 'POST') {
      const pref = req.headers()['prefer'] || '', list = Array.isArray(body) ? body : [body], rows = this.rows(name), upsert = /merge-duplicates/.test(pref), ignore = /ignore-duplicates/.test(pref);
      const out = [];
      for (const r of list) {
        const ex = r.id != null && rows.find((x) => x.id === r.id);
        if (ex && ignore) continue;
        if (ex && !upsert) return json(409, { message: 'duplicate key' });
        if (ex) Object.assign(ex, r); else rows.push(Object.assign({}, r));
        out.push(r);
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(out) });
    }
    return json(405, {});
  }
  writes(table) { return this.log.filter((l) => l.table === table && l.method !== 'GET'); }
}

async function openApp(browser, base, { app, user, tables, fail, viewport, portail, jeton }) {
  const db = new FakeDB(tables);
  Object.assign(db.fail, fail || {});
  if (jeton === false) db.exigeJeton = false; // base d'avant SECURISATION_ETAPE3.sql : la clé publique suffit
  const page = await browser.newPage({ viewport: viewport || (app === 'terrain' ? { width: 402, height: 874 } : { width: 1440, height: 900 }) });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(SB + '/**', (r) => db.handle(r));
  await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://unpkg.com/**', (r) => r.abort()); // l'app ne doit plus en dépendre
  const key = app === 'terrain' ? 'sa_terrain_user' : 'sa_admin_user';
  // Session ouverte : avec un jeton valide, sauf si le test en fournit un (ou auth: null, session d'avant les jetons)
  if (user && user.auth === undefined) { const j = db.emettre(user.id); user = Object.assign({}, user, { auth: { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at } }); }
  // Le portail d'accueil de sa-admin est désactivé par défaut dans les tests (sauf ceux qui le testent : portail: true)
  await page.addInitScript(([k, u, pt]) => { if (!sessionStorage.getItem('__init')) { localStorage.clear(); if (u) localStorage.setItem(k, JSON.stringify(u)); if (!pt) localStorage.setItem('sa_admin_portail', 'off'); sessionStorage.setItem('__init', '1'); } }, [key, user, !!portail]);
  await page.goto(base + '/' + app + '.html');
  return { page, db, errors };
}

/* SA Platform (index.html) : la vraie supabase-js (node_modules) remplace le CDN ; les autres bibliothèques externes
   (xlsx, qrcode, leaflet…) sont remplacées par un script vide. Le compte se connecte par l'écran de connexion. */
const SBJS = path.join(ROOT, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
async function openPlatform(browser, base, { tables, viewport, local } = {}) {
  const db = new FakeDB(tables);
  const page = await browser.newPage({ viewport: viewport || { width: 1280, height: 860 }, serviceWorkers: 'block' });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.route(SB + '/**', (r) => db.handle(r));
  // Playwright : la DERNIÈRE route déclarée l'emporte — du plus général au plus précis
  await page.route(/^https:\/\/(?!ldqvdiaewvhnukuaxdmc)[^/]+\//, (r) => r.abort());
  await page.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)\//, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(SBJS) }));
  await page.routeWebSocket(/supabase\.co\/realtime/, () => {}); // Realtime : jamais vers le vrai serveur
  // local : données déjà sur l'appareil (clés sans le préfixe sa_plat_), posées une seule fois
  if (local) await page.addInitScript((l) => { if (!sessionStorage.getItem('__init')) { Object.keys(l).forEach((k) => localStorage.setItem('sa_plat_' + k, JSON.stringify(l[k]))); sessionStorage.setItem('__init', '1'); } }, local);
  await page.goto(base + '/index.html');
  return { page, db, errors };
}

async function launch() { return chromium.launch(); }

module.exports = { startServer, openApp, openPlatform, launch, FakeDB, iso, addDays, mondayOf, today, weekKey, dayIdx };
