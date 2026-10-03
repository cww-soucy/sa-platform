// Carnet de bord Salle Mécanique — connecteur Port IN / Port OUT vers la table Supabase `water_logs`
// (MIGRATION_2026-10-02_water_logs.sql). Module ES autonome, servi tel quel par Cloudflare Pages : aucune étape de build.
//
//   PORT IN   sendWaterLog(payload)            valide, insère, émet `waterlog:submitted`
//   PORT OUT  subscribeToWaterLogs(id, cb)     nouvelles saisies en temps réel (Supabase Realtime)
//             getLogs(id, options)             historique pour les tableaux de bord et graphiques
//
// Usage dans un autre module de la plateforme :
//   import { getLogs, subscribeToWaterLogs } from '/src/services/waterLogConnector.js';
//   const stop = subscribeToWaterLogs('site-42', (log, { alerts }) => { ... });
//
// Lectures et écritures passent par l'API REST (fetch, comme sa-terrain / sa-admin) : la page QR reste légère.
// supabase-js n'est chargé qu'au premier abonnement temps réel, sauf si la plateforme fournit déjà son client
// (`configureWaterLogConnector({ client: sb })`, ex. le `sb` d'index.html) — il sert alors à tout.

export const SUPABASE_URL = 'https://ldqvdiaewvhnukuaxdmc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_qVd_6eoAvwrDGs9u81woAg_RrMpTJxn';
export const TABLE = 'water_logs';
export const WATERLOG_EVENT = 'waterlog:submitted';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const CHANNEL = 'sa-waterlog';

// Normes sanitaires (piscines publiques, Québec — Règlement sur la qualité de l'eau des piscines et autres bassins
// artificiels, Q-2, r. 39). pH et chlore libre : hors norme = alerte critique. Valeurs modifiables par
// configureWaterLogConnector({ norms }) — chlore libre et alcalinité à confirmer par le responsable qualité de l'eau.
export const WATER_NORMS = Object.freeze({
  ph_level: { min: 7.2, max: 7.8, unit: '', label: 'pH', critical: true },
  free_chlorine: { min: 0.8, max: 2.0, unit: 'mg/L', label: 'Chlore libre', critical: true },
  alkalinity: { min: 80, max: 120, unit: 'mg/L', label: 'Alcalinité', critical: false },
  water_temp: { min: null, max: 40, unit: '°C', label: 'Température', critical: false },
});

// Bornes physiques (mêmes contraintes CHECK que la table) : au-delà, c'est une faute de frappe, la saisie est refusée.
const LIMITS = {
  ph_level: [0, 14, true],
  free_chlorine: [0, 20, true],
  water_temp: [0, 50, false],
  alkalinity: [0, 500, false],
};

const cfg = { url: SUPABASE_URL, key: SUPABASE_KEY, client: null, norms: WATER_NORMS, target: globalThis };
let clientPromise = null;
let bus = null;

export function configureWaterLogConnector(opts = {}) {
  if (opts.url) cfg.url = opts.url;
  if (opts.key) cfg.key = opts.key;
  if (opts.client) { cfg.client = opts.client; clientPromise = Promise.resolve(opts.client); }
  if (opts.norms) cfg.norms = Object.freeze({ ...cfg.norms, ...opts.norms });
  if (opts.target) cfg.target = opts.target;
}

export class WaterLogValidationError extends Error {
  constructor(errors) {
    super(errors.map((e) => e.message).join(' · '));
    this.name = 'WaterLogValidationError';
    this.errors = errors;
  }
}

// « 7,4 » (clavier français) ou 7.4 → 7.4 ; vide → null ; illisible → NaN
function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(',', '.');
  return s === '' ? null : (/^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN);
}
const txt = (v) => (v == null ? '' : String(v).trim());

// Alertes d'un relevé par rapport aux normes : [{ field, level: 'critical'|'warning', message }]. Sert aussi aux
// tableaux de bord pour colorer les lignes reçues par getLogs / subscribeToWaterLogs.
export function evaluateWaterLog(log) {
  const alerts = [];
  for (const [field, n] of Object.entries(cfg.norms)) {
    const v = num(log[field]);
    if (v == null || Number.isNaN(v)) continue;
    const low = n.min != null && v < n.min, high = n.max != null && v > n.max;
    if (!low && !high) continue;
    const fr = (x) => String(x).replace('.', ',');
    const range = n.min != null && n.max != null ? `${fr(n.min)}–${fr(n.max)}` : (n.max != null ? `≤ ${fr(n.max)}` : `≥ ${fr(n.min)}`);
    alerts.push({
      field,
      level: n.critical ? 'critical' : 'warning',
      message: `${n.label} ${low ? 'trop bas' : 'trop élevé'} : ${fr(v)}${n.unit ? ' ' + n.unit : ''} (norme ${range}${n.unit ? ' ' + n.unit : ''})`,
    });
  }
  return alerts;
}

// Valide un formulaire : { ok, errors, alerts, record }. `record` = ligne prête pour `water_logs`.
export function validateWaterLog(payload = {}) {
  const errors = [];
  const record = {
    site_id: txt(payload.site_id),
    technician_name: txt(payload.technician_name),
    ph_level: null, free_chlorine: null, water_temp: null, alkalinity: null,
    notes: txt(payload.notes) || null,
  };
  if (!record.site_id) errors.push({ field: 'site_id', message: 'Site inconnu : scannez le QR de la salle mécanique' });
  if (!record.technician_name) errors.push({ field: 'technician_name', message: 'Nom du technicien requis' });
  for (const [field, [min, max, required]] of Object.entries(LIMITS)) {
    const v = num(payload[field]), label = WATER_NORMS[field].label;
    if (v == null) { if (required) errors.push({ field, message: `${label} requis` }); continue; }
    if (Number.isNaN(v) || v < min || v > max) { errors.push({ field, message: `${label} invalide (entre ${min} et ${max})` }); continue; }
    record[field] = v;
  }
  return { ok: errors.length === 0, errors, alerts: errors.length ? [] : evaluateWaterLog(record), record };
}

async function rest(path, init = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).message || msg; } catch (e) { /* corps vide */ }
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return res.status === 204 ? null : res.json();
}

function emit(detail) {
  const t = cfg.target;
  if (t && typeof t.dispatchEvent === 'function' && typeof CustomEvent === 'function') t.dispatchEvent(new CustomEvent(WATERLOG_EVENT, { detail }));
}

// Relaie `waterlog:submitted` aux autres onglets du même domaine (ex. la plateforme ouverte au bureau sur le même poste)
function channel() {
  if (bus || typeof BroadcastChannel !== 'function') return bus;
  bus = new BroadcastChannel(CHANNEL);
  bus.onmessage = (e) => emit(e.data);
  return bus;
}
channel();

/* ─────────────────────────── PORT IN ─────────────────────────── */

// Valide puis insère un relevé. Résout { log, alerts } (log = ligne enregistrée, avec id et created_at).
// Rejette WaterLogValidationError (données invalides) ou Error (réseau / serveur : `status` absent = hors ligne).
export async function sendWaterLog(payload) {
  const { ok, errors, alerts, record } = validateWaterLog(payload);
  if (!ok) throw new WaterLogValidationError(errors);
  if (payload.created_at) record.created_at = payload.created_at; // saisie hors ligne renvoyée plus tard : garde l'heure du relevé
  let log;
  if (cfg.client) {
    const { data, error } = await cfg.client.from(TABLE).insert(record).select().single();
    if (error) throw Object.assign(new Error(error.message), { status: error.code });
    log = data;
  } else {
    const rows = await rest(TABLE, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(record) });
    log = (Array.isArray(rows) ? rows[0] : rows) || record;
  }
  const detail = { ...log, alerts };
  emit(detail);
  try { channel()?.postMessage(detail); } catch (e) { /* onglet unique */ }
  return { log, alerts };
}

/* ─────────────────────────── PORT OUT ─────────────────────────── */

// Historique d'un site (ou de tous les sites si siteId est vide), le plus récent d'abord par défaut.
// options : { from, to (Date | ISO), limit (500), ascending (false — true pour un graphique chronologique) }
export async function getLogs(siteId, { from, to, limit = 500, ascending = false } = {}) {
  const iso = (d) => (d instanceof Date ? d.toISOString() : String(d));
  if (cfg.client) {
    let q = cfg.client.from(TABLE).select('*');
    if (siteId) q = q.eq('site_id', siteId);
    if (from) q = q.gte('created_at', iso(from));
    if (to) q = q.lt('created_at', iso(to));
    const { data, error } = await q.order('created_at', { ascending }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
  const p = new URLSearchParams({ select: '*', order: `created_at.${ascending ? 'asc' : 'desc'}`, limit: String(limit) });
  if (siteId) p.append('site_id', `eq.${siteId}`);
  if (from) p.append('created_at', `gte.${iso(from)}`);
  if (to) p.append('created_at', `lt.${iso(to)}`);
  return rest(`${TABLE}?${p}`);
}

// Fiche du site visé par un QR (nom affiché en en-tête) ; null si l'identifiant n'existe pas.
export async function getSiteInfo(siteId) {
  if (!siteId) return null;
  const rows = await rest(`sites?select=id,nom,addr&id=eq.${encodeURIComponent(siteId)}`);
  return rows[0] || null;
}

function realtimeClient() {
  if (!clientPromise) {
    clientPromise = import(SUPABASE_JS)
      .then((m) => m.createClient(cfg.url, cfg.key))
      .catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

// Écoute les nouvelles saisies d'un site (tous les sites si siteId est vide) : callback(log, { alerts }).
// Renvoie une fonction de désabonnement, utilisable tout de suite.
export function subscribeToWaterLogs(siteId, callback, { onStatus } = {}) {
  let ch = null, closed = false;
  realtimeClient().then((client) => {
    if (closed) return;
    const filter = siteId ? { filter: `site_id=eq.${siteId}` } : {};
    ch = client
      .channel(`water_logs:${siteId || 'all'}:${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE, ...filter }, (p) => {
        callback(p.new, { alerts: evaluateWaterLog(p.new) });
      })
      .subscribe((status) => onStatus && onStatus(status));
  }).catch((e) => onStatus && onStatus('CHANNEL_ERROR', e));
  return () => {
    closed = true;
    if (ch) ch.unsubscribe();
  };
}
