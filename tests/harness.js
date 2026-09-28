// Banc d'essai commun : sert les fichiers générés en HTTP (comme Cloudflare Pages, pas en file://)
// et remplace Supabase par une petite base en mémoire qui comprend le sous-ensemble de PostgREST utilisé.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SB = 'https://ldqvdiaewvhnukuaxdmc.supabase.co';
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
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      res.end(fs.readFileSync(p));
    }).listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + srv.address().port, close: () => srv.close() }));
  });
}

/* Filtres PostgREST pris en charge : col=eq.x, col=is.null. Les autres (gte, lte, ilike, order, limit…) sont
   ignorés volontairement : la fausse base renvoie alors PLUS que le vrai serveur, ce qui teste le filtrage côté app. */
function filters(qs) {
  const out = [];
  for (const [k, v] of new URLSearchParams(qs)) {
    if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
    if (v.startsWith('eq.')) out.push((r) => String(r[k]) === v.slice(3));
    else if (v === 'is.null') out.push((r) => r[k] == null);
  }
  return (r) => out.every((f) => f(r));
}

class FakeDB {
  constructor(tables) { this.t = JSON.parse(JSON.stringify(tables || {})); this.log = []; this.fail = {}; }
  rows(name) { return (this.t[name] = this.t[name] || []); }
  async handle(route) {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    const name = u.pathname.replace('/rest/v1/', '');
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    this.log.push({ method: m, table: name, query: u.search, body });
    const f = this.fail[name];
    if (f === 'network') return route.abort('failed');
    if (f) return route.fulfill({ status: f, contentType: 'application/json', body: JSON.stringify({ message: 'échec simulé' }) });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (name.startsWith('rpc/')) return json(200, []);
    const match = filters(u.search);
    if (m === 'GET') return json(200, this.rows(name).filter(match));
    if (m === 'PATCH') { const hit = this.rows(name).filter(match); hit.forEach((r) => Object.assign(r, body)); return json(200, hit); }
    if (m === 'DELETE') { const all = this.rows(name), hit = all.filter(match); this.t[name] = all.filter((r) => !hit.includes(r)); return json(200, hit); }
    if (m === 'POST') {
      const list = Array.isArray(body) ? body : [body], rows = this.rows(name), upsert = /merge-duplicates/.test(req.headers()['prefer'] || '');
      const out = [];
      for (const r of list) {
        const ex = r.id != null && rows.find((x) => x.id === r.id);
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

async function openApp(browser, base, { app, user, tables, fail, viewport }) {
  const db = new FakeDB(tables);
  Object.assign(db.fail, fail || {});
  const page = await browser.newPage({ viewport: viewport || (app === 'terrain' ? { width: 402, height: 874 } : { width: 1440, height: 900 }) });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(SB + '/**', (r) => db.handle(r));
  await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://unpkg.com/**', (r) => r.abort()); // l'app ne doit plus en dépendre
  const key = app === 'terrain' ? 'sa_terrain_user' : 'sa_admin_user';
  await page.addInitScript(([k, u]) => { if (!sessionStorage.getItem('__init')) { localStorage.clear(); if (u) localStorage.setItem(k, JSON.stringify(u)); sessionStorage.setItem('__init', '1'); } }, [key, user]);
  await page.goto(base + '/' + app + '.html');
  return { page, db, errors };
}

async function launch() { return chromium.launch(); }

module.exports = { startServer, openApp, launch, FakeDB, iso, addDays, mondayOf, today, weekKey, dayIdx };
