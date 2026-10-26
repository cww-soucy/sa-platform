// Portail client — fonctions pures (testées par tests/portail-fonction.test.js, utilisées par index.ts).
// Sécurité (passation §9) : jetons ≥ 128 bits, codes à usage unique hachés, réponse identique que l'identifiant
// soit autorisé ou non, filtrage par sites autorisés et par niveau d'accès, lecture seule.

export const OTP_MINUTES = 10;
export const OTP_TENTATIVES = 5;
export const OTP_PAR_CONTACT_15MIN = 3;
export const OTP_PAR_IP_HEURE = 10;
export const SESSION_COURTE_H = 12;
export const SESSION_LONGUE_J = 90;
export const ADMIN_H = 12;
/* Code généré par le bureau (sa-admin) et transmis par téléphone quand le courriel ou le texto ne part pas */
export const OTP_MANUEL_MINUTES = 60;
/** Codes encore utilisables d'un contact (le plus récent d'abord) : un code reçu par courriel et un code donné par le bureau restent tous deux valides */
export function otpValides(otps, maintenant = new Date()) {
  return (otps || []).filter((o) => o && !o.utilise && new Date(o.expire_le) >= maintenant && (o.tentatives || 0) < OTP_TENTATIVES)
    .sort((a, b) => String(b.cree_le || "").localeCompare(String(a.cree_le || "")));
}

const NIVEAUX = {
  operateur: { etat: true, releves: true, rqep: true, plans: true, historique: false, rapports: false, interventions: false, exports: false, factures: false },
  gestionnaire: { etat: true, releves: true, rqep: true, plans: true, historique: true, rapports: true, interventions: true, exports: true, factures: false },
  direction: { etat: true, releves: true, rqep: true, plans: true, historique: true, rapports: true, interventions: true, exports: true, factures: true },
  /* Employé du client qui saisit les tests d'eau : son formulaire de saisie et ses tests récents, rien d'autre */
  saisie: { etat: false, releves: false, rqep: false, plans: false, historique: false, rapports: false, interventions: false, exports: false, factures: false },
};
const VIS = { operateur: 1, gestionnaire: 2, direction: 3 };
/** Niveaux qui saisissent des tests d'eau dans le portail */
export function peutSaisir(niveau) { return niveau === "saisie"; }

export function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** Jeton opaque aléatoire (256 bits par défaut) */
export function jeton(octets = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(octets)));
}
/** Code à 6 chiffres, uniforme (rejet des valeurs biaisées) */
export function code6() {
  const a = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(a);
    if (a[0] < 4294000000) return String(a[0] % 1000000).padStart(6, "0");
  }
}
export async function sha256(txt) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(txt)));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Comparaison en temps constant de deux empreintes hexadécimales */
export function egal(a, b) {
  a = String(a || ""); b = String(b || "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
/** Identifiant saisi → { courriel } ou { cellulaire } normalisé, ou null */
export function identifiant(s) {
  s = String(s || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { courriel: s.toLowerCase() };
  const d = s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? { cellulaire: d } : null;
}
export function masquer(id) {
  id = String(id || "");
  if (id.indexOf("@") > 0) { const p = id.split("@"); return p[0].charAt(0) + "•••••@" + p[1]; }
  const d = id.replace(/\D/g, ""); return d ? "•••-•••-" + d.slice(-4) : "•••";
}
export function droits(niveau, surcharge) {
  const d = { ...(NIVEAUX[niveau] || NIVEAUX.operateur) };
  const s = surcharge && surcharge[niveau];
  if (s) for (const k of Object.keys(d)) if (k in s) d[k] = !!s[k];
  return d;
}
export function visible(visibilite, niveau) {
  return visibilite !== "interne" && (VIS[niveau] || 0) >= (VIS[visibilite] || 9);
}
/** Sites autorisés pour un contact : sa propre liste s'il en a une (un même courriel peut suivre des sites de plusieurs comptes),
 *  sinon tous les sites de son compte. Seul sa-admin écrit ces listes (admin_ecrire). */
export function sitesAutorises(compte, contact) {
  if (Array.isArray(contact && contact.sites) && contact.sites.length) return [...new Set(contact.sites.map(String))];
  return Array.isArray(compte && compte.sites) ? compte.sites.map(String) : [];
}
/**
 * Test d'eau saisi par un employé du client → ligne de « releves » (statut « client » : jamais compté comme une visite publiée).
 * T = type de relevé (champs) ; e = { site_id, bassin, vals: {clé: valeur}, note } ; renvoie { row } ou { erreur }.
 */
export function releveClient(T, e, { contact, site, maintenant = new Date(), id }) {
  const champs = (T && Array.isArray(T.fields) ? T.fields : []).filter((f) => f && f.key);
  const vals = {}, touched = {};
  for (const f of champs) {
    const brut = e && e.vals ? e.vals[f.key] : undefined;
    if (brut == null || String(brut).trim() === "") continue;
    const n = Number(String(brut).replace(",", "."));
    if (!isFinite(n) || n < -50 || n > 100000) return { erreur: `Valeur invalide pour ${f.label || f.key}` };
    vals[f.key] = Math.round(n * 1000) / 1000; touched[f.key] = 1;
  }
  if (!Object.keys(vals).length) return { erreur: "Entrez au moins une mesure" };
  const bassins = (Array.isArray(site.bassins) ? site.bassins : []).filter((b) => b && b.nom);
  const bassin = bassins.length ? (bassins.find((b) => b.nom === (e && e.bassin)) || null) : null;
  if (bassins.length > 1 && !bassin) return { erreur: "Choisissez le bassin" };
  const loc = new Date(maintenant.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const pad = (x) => String(x).padStart(2, "0"), iso = maintenant.toISOString();
  return { row: {
    id, site_id: String(site.id), site_nom: site.nom || "", bassin: bassin ? bassin.nom : (bassins[0] ? bassins[0].nom : null),
    date: `${loc.getFullYear()}-${pad(loc.getMonth() + 1)}-${pad(loc.getDate())}`, heure: `${pad(loc.getHours())}:${pad(loc.getMinutes())}`,
    type_code: (T && T.code) || "GEN", vals, touched, note: String((e && e.note) || "").slice(0, 500),
    tech: "client:" + contact.id, tech_nom: contact.nom || "", source: "client", saisi_par: contact.id, statut: "client", created_at: iso, updated_at: iso,
  } };
}
/** Test d'eau sans connexion (lien du code QR) : mesures permises et bornes */
export const TEST_LIBRE = [
  ["ph", "pH", 0, 14], ["cl", "Chlore libre", 0, 20],
  ["becsys_mv", "BECSys — potentiel (mV)", 0, 1500], ["becsys_ppm", "BECSys — chlore (ppm)", 0, 20], ["becsys_ph", "BECSys — pH lu", 0, 14],
];
export const TEST_LIBRE_PAR_IP_HEURE = 30;
/**
 * Test d'eau saisi SANS connexion depuis le lien du code QR : nom de l'employé, bassin, pH, chlore et lecture du BECSys
 * (mV, ppm, pH lu) ; date et heure mises par le serveur. → ligne de « releves » (statut « client », source « carnet »).
 * cles = clés des champs du type de relevé (le chlore va sous « clr » pour les jeux d'eau, sinon « cl »).
 */
export function testLibre(e, { site, cles = [], maintenant = new Date(), id, typeCode = "GEN" }) {
  const employe = String((e && e.employe) || "").replace(/\s+/g, " ").trim();
  if (employe.length < 2) return { erreur: "Entrez le nom de l’employé qui fait le test" };
  if (employe.length > 80) return { erreur: "Nom trop long" };
  const bassins = (Array.isArray(site.bassins) ? site.bassins : []).filter((b) => b && b.nom);
  const bassin = bassins.find((b) => b.nom === (e && e.bassin)) || (bassins.length === 1 ? bassins[0] : null);
  if (bassins.length > 1 && !bassin) return { erreur: "Choisissez le bassin testé" };
  const vals = {}, touched = {};
  for (const [k, lib, min, max] of TEST_LIBRE) {
    const brut = e && e.mesures ? e.mesures[k] : undefined;
    if (brut == null || String(brut).trim() === "") continue;
    const n = Number(String(brut).replace(",", "."));
    if (!isFinite(n) || n < min || n > max) return { erreur: `Valeur invalide : ${lib} (${min} à ${max})` };
    const cle = k === "cl" && !cles.includes("cl") && cles.includes("clr") ? "clr" : k;
    vals[cle] = Math.round(n * 1000) / 1000; touched[cle] = 1;
  }
  if (!Object.keys(vals).length) return { erreur: "Entrez au moins une mesure" };
  const loc = new Date(maintenant.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const pad = (x) => String(x).padStart(2, "0"), iso = maintenant.toISOString();
  return { row: {
    id, site_id: String(site.id), site_nom: site.nom || "", bassin: bassin ? bassin.nom : null,
    date: `${loc.getFullYear()}-${pad(loc.getMonth() + 1)}-${pad(loc.getDate())}`, heure: `${pad(loc.getHours())}:${pad(loc.getMinutes())}`,
    type_code: typeCode, vals, touched, tech: "carnet", tech_nom: employe, source: "carnet", source_detail: "Test sans connexion (code QR)",
    statut: "client", created_at: iso, updated_at: iso,
  } };
}
/** Limitation : faut-il refuser un nouvel envoi de code ? */
export function tropDeCodes(nContact15, nIpHeure) {
  return nContact15 >= OTP_PAR_CONTACT_15MIN || nIpHeure >= OTP_PAR_IP_HEURE;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const FAIT = /^(complete|complété|termine|terminé|facture|facturé|fait|ferme|fermé)$/i;

/**
 * Données visibles par un contact (ou un aperçu sa-admin) : seulement ses sites, selon son niveau.
 * src = { sites, types, catalogue, releves, workorders, documents } (lus avec la clé service)
 */
export function donneesClient(src, { niveau, droitsCompte, sitesOk, maintenant = new Date() }) {
  const d = droits(niveau, droitsCompte);
  const ok = new Set(sitesOk.map(String));
  const sites = (src.sites || []).filter((s) => ok.has(String(s.id))).map((s) => ({
    id: String(s.id), nom: s.nom, addr: s.addr || "",
    bassins: (Array.isArray(s.bassins) ? s.bassins : []).filter((b) => b && b.nom).map((b) => ({
      id: String(b.id || b.nom), nom: b.nom, type_code: b.type_code || null, numero: b.numero || null,
      plan_doc: d.plans ? b.plan_doc || null : null, plan_x: d.plans ? b.plan_x ?? null : null, plan_y: d.plans ? b.plan_y ?? null : null,
    })),
  }));
  const jours = d.historique ? (d.exports ? 400 : 120) : 31;
  const depuis = new Date(maintenant.getTime() - jours * 864e5).toISOString().slice(0, 10);
  const releves = (src.releves || [])
    .filter((r) => ok.has(String(r.site_id)) && (r.statut || "publiee") === "publiee" && String(r.date) >= depuis)
    .map((r) => {
      const points = {};
      for (const [k, v] of Object.entries(r.points || {})) {
        points[k] = { etat: v && v.etat, valeur: v && v.valeur != null ? v.valeur : undefined, wo_id: v && v.wo_id ? true : undefined,
          note: d.rapports && v && v.note ? v.note : undefined, photos: d.rapports && v && Array.isArray(v.photos) ? v.photos : undefined };
      }
      return { id: r.id, site_id: String(r.site_id), bassin: r.bassin || null, date: r.date, heure: r.heure, type_code: r.type_code,
        vals: d.releves ? r.vals || {} : {}, touched: d.releves ? r.touched || null : {}, checks: r.checks || null, points: r.points ? points : null,
        actions: d.rapports ? r.actions || null : null, tech_nom: d.rapports ? r.tech_nom || "" : "", resume: d.rapports ? r.resume || "" : "" };
    });
  /* Tests d'eau saisis par les employés du client (statut « client ») : vus par eux et par les niveaux qui voient les relevés */
  const depuisT = new Date(maintenant.getTime() - Math.max(jours, 31) * 864e5).toISOString().slice(0, 10);
  const tests = d.releves || peutSaisir(niveau) ? (src.releves || [])
    .filter((r) => ok.has(String(r.site_id)) && r.statut === "client" && String(r.date) >= depuisT)
    .map((r) => ({ id: r.id, site_id: String(r.site_id), bassin: r.bassin || null, date: r.date, heure: r.heure, type_code: r.type_code, vals: r.vals || {}, tech_nom: r.tech_nom || "", note: r.note || "" }))
    .sort((a, b) => String(b.date + (b.heure || "")).localeCompare(String(a.date + (a.heure || "")))) : [];
  const noms = sites.map((s) => norm(s.nom));
  const ilim = new Date(maintenant.getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const interventions = d.interventions ? (src.workorders || [])
    .filter((w) => noms.includes(norm(w.site)) || noms.includes(norm(w.client)))
    .filter((w) => !FAIT.test(String(w.status || "")) || String(w.date || "") >= ilim)
    .map((w) => ({ date: w.date || "", type: w.type || "Intervention", urgent: w.priorite === "urgent", faite: FAIT.test(String(w.status || "")),
      site: sites.find((s) => norm(s.nom) === norm(w.site) || norm(s.nom) === norm(w.client))?.id || null }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
  const documents = (src.documents || []).filter((x) => visible(x.visibilite, niveau)
    && (x.type !== "plan" || d.plans) && (x.portee === "client" || ok.has(String(x.site_id))))
    .map((x) => ({ id: x.id, titre: x.titre, type: x.type, niveau_plan: x.niveau_plan || "", site_id: x.site_id || null, bassin_id: x.bassin_id || null,
      mime: x.mime || "", taille: x.taille || 0, storage_path: x.storage_path }));
  return { droits: d, saisie: peutSaisir(niveau), sites, releves, tests, interventions, documents, types: src.types || {}, catalogue: src.catalogue || [] };
}

/** Colonnes modifiables depuis sa-admin (tout le reste est ignoré) */
export const ECRITURE = {
  client_comptes: ["id", "nom", "logo_path", "sites", "niveaux"],
  client_contacts: ["id", "compte_id", "nom", "courriel", "cellulaire", "niveau", "sites", "actif"],
  documents: ["id", "portee", "compte_id", "site_id", "bassin_id", "titre", "type", "niveau_plan", "storage_path", "mime", "taille", "visibilite"],
};
export function filtrerLigne(table, row) {
  const cols = ECRITURE[table];
  if (!cols || !row || typeof row !== "object" || !row.id) return null;
  const o = {};
  for (const c of cols) if (c in row) o[c] = row[c];
  if (table === "client_contacts") {
    const idt = identifiant(o.courriel || "");
    o.courriel = o.courriel ? (idt && idt.courriel) || null : null;
    const cel = identifiant(o.cellulaire || "");
    o.cellulaire = o.cellulaire ? (cel && cel.cellulaire) || null : null;
  }
  o.updated_at = new Date().toISOString();
  return o;
}
export function nomFichier(nom) {
  return String(nom || "fichier").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
}
