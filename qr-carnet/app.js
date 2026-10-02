// Carnet de bord Salle Mécanique — logique de la page (fichier séparé : la CSP de /qr-carnet/* interdit les scripts en ligne)
import {
  sendWaterLog, getLogs, getSiteInfo, validateWaterLog, evaluateWaterLog,
  WaterLogValidationError, WATER_NORMS,
} from '../src/services/waterLogConnector.js';

const $ = (id) => document.getElementById(id);
const FIELDS = ['ph_level', 'free_chlorine', 'water_temp', 'alkalinity'];
const NAME_KEY = 'sa_qr_carnet_tech';
const QUEUE_KEY = 'sa_qr_carnet_queue';
const siteId = (new URLSearchParams(location.search).get('site') || '').trim();
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* navigation privée */ } },
};
const fmt = (v) => (v == null || v === '' ? '—' : String(v).replace('.', ','));
const when = (iso) => (!iso ? 'à l’instant' : new Date(iso).toLocaleString('fr-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));

/* ── Réseau ── */
function setNet() {
  const on = navigator.onLine;
  $('net').textContent = on ? 'En ligne' : 'Hors ligne';
  $('net').classList.toggle('off', !on);
}
addEventListener('online', () => { setNet(); flush(); });
addEventListener('offline', setNet);
setNet();

/* ── Normes affichées sous chaque champ + couleur en direct ── */
for (const f of FIELDS) {
  const n = WATER_NORMS[f], box = document.querySelector(`[data-field="${f}"]`);
  const range = n.min != null ? `${fmt(n.min)} – ${fmt(n.max)}` : `≤ ${fmt(n.max)}`;
  box.querySelector('.norm').textContent = `Norme ${range}${n.unit ? ' ' + n.unit : ''}`;
  $(f).addEventListener('input', () => paint(f));
}
function paint(f) {
  const box = document.querySelector(`[data-field="${f}"]`), raw = $(f).value.trim();
  box.classList.remove('ok', 'crit', 'warn');
  document.querySelector(`[data-err="${f}"]`).textContent = '';
  if (!raw) return;
  const v = Number(raw.replace(',', '.'));
  if (!Number.isFinite(v)) { box.classList.add('crit'); return; }
  const a = evaluateWaterLog({ [f]: v })[0];
  box.classList.add(!a ? 'ok' : a.level === 'critical' ? 'crit' : 'warn');
}

/* ── File d'attente hors ligne : salle mécanique souvent sans réseau ── */
function queue() { return store.get(QUEUE_KEY, []); }
function showPending() {
  const n = queue().length;
  $('pending').hidden = !n;
  $('pending').textContent = n ? `${n} relevé${n > 1 ? 's' : ''} en attente d'envoi — envoi automatique dès le retour du réseau.` : '';
}
let flushing = false;
async function flush() {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  try {
    let q = queue();
    while (q.length) {
      try { await sendWaterLog(q[0]); }
      catch (e) { if (!(e instanceof WaterLogValidationError)) break; } // réseau ou serveur : on garde le relevé et on réessaiera
      q = queue().slice(1);
      store.set(QUEUE_KEY, q);
    }
  } finally {
    flushing = false;
    showPending();
    loadHistory();
  }
}

/* ── Historique du site ── */
async function loadHistory() {
  if (!siteId) return;
  const pend = queue().filter((p) => p.site_id === siteId).map((p) => ({ ...p, _pending: true }));
  let rows = [];
  try { rows = await getLogs(siteId, { limit: 5 }); } catch (e) { /* hors ligne : seulement la file locale */ }
  const all = [...pend.reverse(), ...rows].slice(0, 5);
  $('histWrap').hidden = !all.length;
  $('hist').replaceChildren(...all.map((r) => {
    const li = document.createElement('li');
    const crit = evaluateWaterLog(r).some((a) => a.level === 'critical');
    li.className = r._pending ? 'pending' : crit ? 'crit' : '';
    const h = document.createElement('div'); h.className = 'h';
    const a = document.createElement('span'); a.textContent = r.technician_name;
    const b = document.createElement('span'); b.textContent = r._pending ? 'En attente · ' + when(r.created_at) : when(r.created_at);
    h.append(a, b);
    const v = document.createElement('div'); v.className = 'v';
    v.textContent = `pH ${fmt(r.ph_level)} · Cl ${fmt(r.free_chlorine)} · ${fmt(r.water_temp)} °C · Alc ${fmt(r.alkalinity)}`;
    li.append(h, v);
    if (r.notes) { const n = document.createElement('div'); n.textContent = r.notes; n.style.color = 'var(--ink-2)'; li.append(n); }
    return li;
  }));
}

/* ── Envoi ── */
function showErrors(errors) {
  for (const e of errors) {
    const el = document.querySelector(`[data-err="${e.field}"]`);
    if (el) el.textContent = e.message; else $('formErr').textContent = e.message;
  }
  const first = errors.find((e) => $(e.field));
  if (first) $(first.field).focus();
}
function showDone(alerts, offline) {
  const crit = alerts.some((a) => a.level === 'critical');
  $('f').hidden = true;
  $('done').hidden = false;
  $('done').classList.toggle('crit', crit);
  $('doneIco').textContent = crit ? '!' : '✓';
  $('doneTitle').textContent = offline ? 'Relevé conservé sur l’appareil' : 'Relevé enregistré';
  $('doneText').textContent = (offline ? 'Pas de réseau : il sera envoyé automatiquement. ' : '')
    + (crit ? 'Valeurs hors norme — appliquez la procédure de correction et avisez le superviseur.' : alerts.length ? 'À surveiller :' : 'Toutes les valeurs sont dans les normes.');
  $('doneAlerts').replaceChildren(...alerts.map((a) => Object.assign(document.createElement('li'), { textContent: a.message })));
  scrollTo(0, 0);
}

$('f').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  document.querySelectorAll('.err').forEach((e) => { e.textContent = ''; });
  const fd = new FormData($('f'));
  const payload = { site_id: siteId, ...Object.fromEntries(fd) };
  const check = validateWaterLog(payload);
  if (!check.ok) return showErrors(check.errors);
  store.set(NAME_KEY, check.record.technician_name);
  $('submit').disabled = true;
  try {
    const { alerts } = await sendWaterLog(payload);
    showDone(alerts, false);
  } catch (e) {
    if (e instanceof WaterLogValidationError) showErrors(e.errors);
    else if (!e.status) { // réseau : on garde le relevé et l'heure réelle de la mesure
      store.set(QUEUE_KEY, [...queue(), { ...payload, created_at: new Date().toISOString() }]);
      showPending();
      showDone(check.alerts, true);
    } else $('formErr').textContent = `Enregistrement refusé par le serveur : ${e.message}`;
  } finally {
    $('submit').disabled = false;
    loadHistory();
  }
});

$('again').addEventListener('click', () => {
  for (const f of FIELDS) { $(f).value = ''; paint(f); }
  $('notes').value = '';
  $('done').hidden = true;
  $('f').hidden = false;
  $('ph_level').focus();
});

/* ── Démarrage ── */
if (!siteId) {
  $('noSite').hidden = false;
  $('siteName').textContent = 'Site non identifié';
} else {
  $('f').hidden = false;
  $('technician_name').value = store.get(NAME_KEY, '');
  $('siteName').textContent = `Site ${siteId}`;
  getSiteInfo(siteId).then((s) => {
    if (s) { $('siteName').textContent = s.nom || `Site ${siteId}`; document.title = `Carnet · ${s.nom || siteId}`; }
    else { $('unknownSite').hidden = false; $('unknownSite').textContent = `Le site « ${siteId} » n'existe pas dans la plateforme. Vérifiez le code QR avant d'enregistrer.`; }
  }).catch(() => { /* hors ligne : on garde l'identifiant */ });
  (store.get(NAME_KEY, '') ? $('ph_level') : $('technician_name')).focus();
  showPending();
  loadHistory();
  flush();
}
window.__qrCarnet = { siteId, flush, queue };
