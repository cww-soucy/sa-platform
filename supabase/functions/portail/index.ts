// Edge Function : portail (v1) — portail client sécurisé + gestion des accès depuis sa-admin.
// Passation : docs/design_handoff_inspections_portail/README.md §9.
//  * Le jeton QR identifie un site/bassin ; il n'ouvre aucune donnée.
//  * Accès après code à usage unique (6 chiffres, 10 min, 5 essais, limité par contact et par IP), envoyé au courriel
//    ou au cellulaire inscrit ; réponse identique que l'identifiant soit autorisé ou non.
//  * Toutes les lectures passent ici (clé service) ; les tables client_* / documents n'ont aucune politique pour anon.
//  * Fichiers en bucket privé « portail », servis par URL signées de 10 minutes. Lecture seule. Chaque accès est journalisé.
//  * sa-admin : session de gestion ouverte avec identifiant + mot de passe (verifier_connexion), rôle admin ou superviseur (mêmes droits).
// Envoi des codes : RESEND_API_KEY (+ PORTAIL_FROM) pour le courriel, TWILIO_SID/TWILIO_TOKEN/TWILIO_FROM pour le texto.
// Déploiement : verify_jwt = false (le portail n'a pas de compte Supabase ; l'accès est contrôlé ci-dessous).
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as L from "./lib.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINES = (Deno.env.get("PORTAIL_ORIGINS") || "https://sa-platform.pages.dev").split(",").map((s) => s.trim());
const PORTAIL_URL = Deno.env.get("PORTAIL_URL") || "https://sa-platform.pages.dev/portail/";
const URGENCE = Deno.env.get("PORTAIL_URGENCE") || "";
const BUCKET = "portail";

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINES.includes(o) ? o : ORIGINES[0],
    "Access-Control-Allow-Headers": "content-type, x-portail-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

async function ipHash(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
  return (await L.sha256("ip|" + ip)).slice(0, 32);
}
async function journal(req: Request, row: Record<string, unknown>) {
  await sb.from("client_acces_journal").insert({ ...row, ip_hash: await ipHash(req), user_agent: (req.headers.get("user-agent") || "").slice(0, 200) });
}

async function envoyerCode(contact: { courriel?: string; cellulaire?: string }, code: string) {
  const txt = `Votre code Soucy Aquatik : ${code}. Il expire dans ${L.OTP_MINUTES} minutes. Si vous n'avez rien demandé, ignorez ce message.`;
  if (contact.courriel && Deno.env.get("RESEND_API_KEY")) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: Deno.env.get("PORTAIL_FROM") || "Soucy Aquatik <portail@soucyaquatik.com>", to: [contact.courriel], subject: `Code d'accès : ${code}`, text: txt }),
    });
    if (!r.ok) console.error("resend", r.status, (await r.text()).slice(0, 300));
    return r.ok;
  }
  if (contact.cellulaire && Deno.env.get("TWILIO_SID")) {
    const sid = Deno.env.get("TWILIO_SID")!, tok = Deno.env.get("TWILIO_TOKEN")!;
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: "+1" + contact.cellulaire, From: Deno.env.get("TWILIO_FROM") || "", Body: txt }),
    });
    if (!r.ok) console.error("twilio", r.status, (await r.text()).slice(0, 300));
    return r.ok;
  }
  console.error("envoi : aucun fournisseur configuré (RESEND_API_KEY / TWILIO_SID)");
  return false;
}
async function envoyerCourriel(to: string, sujet: string, texte: string) {
  if (!Deno.env.get("RESEND_API_KEY")) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("PORTAIL_FROM") || "Soucy Aquatik <portail@soucyaquatik.com>", to: [to], subject: sujet, text: texte }),
  });
  if (!r.ok) console.error("resend", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}

async function session(req: Request, genre: "client" | "admin") {
  const t = req.headers.get("x-portail-session") || "";
  if (t.length < 20) return null;
  const { data } = await sb.from("client_sessions").select("id, contact_id, role, expire_le, revoque, genre").eq("jeton_hash", await L.sha256(t)).maybeSingle();
  if (!data || data.revoque || data.genre !== genre || new Date(data.expire_le) < new Date()) return null;
  return data;
}
async function nouvelleSession(genre: "client" | "admin", contact_id: string, heures: number, role: string | null = null) {
  const t = L.jeton();
  await sb.from("client_sessions").insert({ genre, contact_id, role, jeton_hash: await L.sha256(t), expire_le: new Date(Date.now() + heures * 36e5).toISOString() });
  return t;
}

/** Données d'un compte client (lecture par la clé service, puis filtrage par niveau et sites autorisés) */
async function charger(compte: Record<string, any>, sitesOk: string[], niveau: string) {
  const ids = sitesOk.length ? sitesOk : ["__aucun__"];
  const [sites, contrats, types, cat, rel, docs] = await Promise.all([
    sb.from("sites").select("id, nom, addr, bassins").in("id", ids),
    sb.from("contrats").select("site_id, type_code").in("site_id", ids),
    sb.from("types_bassin").select("code, label, court, fields, checks"),
    sb.from("inspection_points").select("*").eq("actif", true),
    sb.from("releves").select("id, site_id, bassin, date, heure, type_code, vals, touched, checks, points, actions, statut, resume, tech_nom")
      .in("site_id", ids).gte("date", new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)).order("date", { ascending: true }),
    sb.from("documents").select("*").or(`compte_id.eq.${compte.id},site_id.in.(${ids.map((x) => `"${x}"`).join(",")})`),
  ]);
  const noms = (sites.data || []).map((s: any) => s.nom).filter(Boolean);
  const wo = noms.length ? await sb.from("workorders").select("date, type, status, priorite, site, client").or(noms.map((n: string) => `site.eq."${n.replace(/"/g, "")}",client.eq."${n.replace(/"/g, "")}"`).join(",")) : { data: [] };
  const T: Record<string, unknown> = {};
  (types.data || []).forEach((t: any) => { T[t.code] = { label: t.label, court: t.court, fields: t.fields || [], checks: t.checks || [] }; });
  const ct: Record<string, string> = {};
  (contrats.data || []).forEach((c: any) => { ct[c.site_id] = c.type_code; });
  const out = L.donneesClient({ sites: (sites.data || []).map((s: any) => ({ ...s, type_code: ct[s.id] || "GEN" })), types: T, catalogue: cat.data || [], releves: rel.data || [], workorders: wo.data || [], documents: docs.data || [] },
    { niveau, droitsCompte: compte.niveaux, sitesOk });
  const signe = async (p: string | null) => (p ? (await sb.storage.from(BUCKET).createSignedUrl(p, 600)).data?.signedUrl || null : null);
  for (const d of out.documents as any[]) { d.url = await signe(d.storage_path); delete d.storage_path; }
  (out as any).contrats = ct;
  (out as any).compte = { nom: compte.nom, logo: await signe(compte.logo_path) };
  (out as any).urgence = URGENCE;
  return out;
}

const actions: Record<string, (req: Request, b: any) => Promise<Response>> = {
  // ---------- Client ----------
  async qr(req, b) {
    const { data: q } = await sb.from("client_qr").select("id, site_id, bassin_id, code_affiche, actif").eq("jeton", String(b.jeton || "")).maybeSingle();
    if (!q || !q.actif) { await journal(req, { qr_id: q?.id || null, action: "qr", resultat: "revoque" }); return json(req, { ok: false, desactive: true }); }
    const { data: s } = await sb.from("sites").select("nom, bassins").eq("id", q.site_id).maybeSingle();
    const b0 = (s?.bassins || []).find((x: any) => String(x.id) === String(q.bassin_id));
    return json(req, { ok: true, site_id: q.site_id, site: s?.nom || "", bassin: b0?.nom || "", code: q.code_affiche, carnet: `../qr-carnet/?site=${encodeURIComponent(q.site_id)}` });
  },
  async demander_code(req, b) {
    const idt = L.identifiant(b.identifiant);
    const reponse = { ok: true, masque: L.masquer(b.identifiant), minutes: L.OTP_MINUTES };
    if (!idt) return json(req, reponse);
    const ip = await ipHash(req);
    let q = sb.from("client_contacts").select("id, compte_id, courriel, cellulaire, sites").eq("actif", true);
    q = idt.courriel ? q.eq("courriel", idt.courriel) : q.eq("cellulaire", idt.cellulaire);
    const { data: c } = await q.limit(1).maybeSingle();
    const ilY15 = new Date(Date.now() - 15 * 6e4).toISOString(), ilY60 = new Date(Date.now() - 36e5).toISOString();
    const [nc, ni] = await Promise.all([
      c ? sb.from("client_otp").select("id", { count: "exact", head: true }).eq("contact_id", c.id).gte("cree_le", ilY15) : Promise.resolve({ count: 0 }),
      sb.from("client_otp").select("id", { count: "exact", head: true }).eq("ip_hash", ip).gte("cree_le", ilY60),
    ]);
    if (!c) { await journal(req, { identifiant: L.masquer(b.identifiant), action: "code", resultat: "refuse" }); return json(req, reponse); }
    if (L.tropDeCodes(nc.count || 0, ni.count || 0)) { await journal(req, { contact_id: c.id, identifiant: L.masquer(b.identifiant), action: "code", resultat: "refuse" }); return json(req, reponse); }
    const code = L.code6();
    await sb.from("client_otp").insert({ contact_id: c.id, code_hash: await L.sha256(c.id + "|" + code), expire_le: new Date(Date.now() + L.OTP_MINUTES * 6e4).toISOString(), ip_hash: ip });
    const envoye = await envoyerCode(idt.courriel ? { courriel: c.courriel } : { cellulaire: c.cellulaire }, code);
    await journal(req, { contact_id: c.id, compte_id: c.compte_id, identifiant: L.masquer(b.identifiant), action: "code", resultat: envoye ? "otp_envoye" : "envoi_impossible" });
    return json(req, reponse);
  },
  async verifier_code(req, b) {
    const idt = L.identifiant(b.identifiant), refus = { ok: false, message: "Code incorrect ou expiré." };
    if (!idt || !/^\d{6}$/.test(String(b.code || ""))) return json(req, refus);
    let q = sb.from("client_contacts").select("id, compte_id").eq("actif", true);
    q = idt.courriel ? q.eq("courriel", idt.courriel) : q.eq("cellulaire", idt.cellulaire);
    const { data: c } = await q.limit(1).maybeSingle();
    if (!c) return json(req, refus);
    const { data: o } = await sb.from("client_otp").select("id, code_hash, expire_le, tentatives, utilise").eq("contact_id", c.id).order("cree_le", { ascending: false }).limit(1).maybeSingle();
    if (!o || o.utilise || new Date(o.expire_le) < new Date() || o.tentatives >= L.OTP_TENTATIVES) { await journal(req, { contact_id: c.id, action: "verification", resultat: "otp_echoue" }); return json(req, refus); }
    const bon = L.egal(await L.sha256(c.id + "|" + b.code), o.code_hash);
    await sb.from("client_otp").update({ tentatives: o.tentatives + 1, utilise: bon }).eq("id", o.id);
    if (!bon) { await journal(req, { contact_id: c.id, action: "verification", resultat: "otp_echoue" }); return json(req, refus); }
    const t = await nouvelleSession("client", c.id, b.souvenir ? L.SESSION_LONGUE_J * 24 : L.SESSION_COURTE_H);
    await sb.from("client_contacts").update({ dernier_acces: new Date().toISOString() }).eq("id", c.id);
    await journal(req, { contact_id: c.id, compte_id: c.compte_id, action: "connexion", resultat: "ok" });
    return json(req, { ok: true, session: t, jours: b.souvenir ? L.SESSION_LONGUE_J : 0 });
  },
  async donnees(req, b) {
    const s = await session(req, "client");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const { data: c } = await sb.from("client_contacts").select("*").eq("id", s.contact_id).maybeSingle();
    if (!c || !c.actif) return json(req, { ok: false, session: false }, 401);
    const { data: compte } = await sb.from("client_comptes").select("*").eq("id", c.compte_id).maybeSingle();
    if (!compte) return json(req, { ok: false, session: false }, 401);
    const out = await charger(compte, L.sitesAutorises(compte, c), c.niveau);
    await journal(req, { contact_id: c.id, compte_id: compte.id, action: "lecture" + (b.site ? ":" + b.site : ""), resultat: "ok" });
    return json(req, { ok: true, contact: { nom: c.nom, niveau: c.niveau }, ...out });
  },
  async deconnexion(req) {
    const t = req.headers.get("x-portail-session") || "";
    if (t) await sb.from("client_sessions").update({ revoque: true }).eq("jeton_hash", await L.sha256(t));
    return json(req, { ok: true });
  },
  // ---------- sa-admin ----------
  async admin_ouvrir(req, b) {
    const { data: rows } = await sb.rpc("verifier_connexion", { p_id: String(b.id || "").toLowerCase(), p_mdp: String(b.mdp || "") });
    const u = Array.isArray(rows) && rows[0];
    if (!u || !["admin", "superviseur"].includes(u.role)) { await journal(req, { identifiant: "sa-admin:" + String(b.id || ""), action: "admin", resultat: "refuse" }); return json(req, { ok: false, message: "Identifiant ou mot de passe incorrect, ou rôle insuffisant." }, 403); }
    return json(req, { ok: true, session: await nouvelleSession("admin", u.id, L.ADMIN_H, u.role), role: u.role });
  },
  async admin_lire(req) {
    const s = await session(req, "admin");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const [cp, ct, qr, jr, dc] = await Promise.all([
      sb.from("client_comptes").select("*").order("nom"),
      sb.from("client_contacts").select("*").order("nom"),
      sb.from("client_qr").select("*").order("cree_le", { ascending: false }),
      sb.from("client_acces_journal").select("*").order("quand", { ascending: false }).limit(300),
      sb.from("documents").select("*").order("titre"),
    ]);
    const signe = async (p: string | null) => (p ? (await sb.storage.from(BUCKET).createSignedUrl(p, 600)).data?.signedUrl || null : null);
    const docs = await Promise.all((dc.data || []).map(async (d: any) => ({ ...d, url: await signe(d.storage_path) })));
    const comptes = await Promise.all((cp.data || []).map(async (c: any) => ({ ...c, logo_url: await signe(c.logo_path) })));
    return json(req, { ok: true, role: s.role, comptes, contacts: ct.data || [], qr: qr.data || [], journal: jr.data || [], documents: docs, portail: PORTAIL_URL, envoi: !!Deno.env.get("RESEND_API_KEY") });
  },
  async admin_ecrire(req, b) {
    const s = await session(req, "admin");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const table = String(b.table || "");
    if (!L.ECRITURE[table]) return json(req, { ok: false, message: "Table non permise" }, 400);
    if (b.supprimer) {
      const { error } = await sb.from(table).delete().eq("id", String(b.id || ""));
      return json(req, { ok: !error, message: error?.message });
    }
    const row = L.filtrerLigne(table, b.row);
    if (!row) return json(req, { ok: false, message: "Ligne invalide" }, 400);
    const { error } = await sb.from(table).upsert(row);
    await journal(req, { identifiant: "sa-admin:" + s.contact_id, action: "ecriture:" + table + ":" + row.id, resultat: error ? "refuse" : "ok" });
    return json(req, { ok: !error, message: error?.message });
  },
  async admin_qr(req, b) {
    const s = await session(req, "admin");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const site = String(b.site_id || ""), bassin = b.bassin_id ? String(b.bassin_id) : null;
    if (!site) return json(req, { ok: false, message: "Site manquant" }, 400);
    let old = sb.from("client_qr").update({ actif: false, revoque_le: new Date().toISOString() }).eq("site_id", site).eq("actif", true);
    old = bassin ? old.eq("bassin_id", bassin) : old.is("bassin_id", null);
    await old;
    const row = { id: "qr-" + L.jeton(9), site_id: site, bassin_id: bassin, jeton: L.jeton(18), code_affiche: String(b.code_affiche || "SA").slice(0, 24), actif: true };
    const { error } = await sb.from("client_qr").insert(row);
    await journal(req, { identifiant: "sa-admin:" + s.contact_id, qr_id: row.id, action: "qr_regenere", resultat: error ? "refuse" : "ok" });
    return json(req, { ok: !error, qr: row, url: PORTAIL_URL + "?q=" + row.jeton, message: error?.message });
  },
  async admin_televerser(req, b) {
    const s = await session(req, "admin");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const path = `${String(b.dossier || "docs").replace(/[^a-z]/g, "") || "docs"}/${Date.now().toString(36)}-${L.nomFichier(b.nom)}`;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    return json(req, { ok: !error, path, url: data?.signedUrl, token: data?.token, message: error?.message });
  },
  async admin_apercu(req, b) {
    const s = await session(req, "admin");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const { data: compte } = await sb.from("client_comptes").select("*").eq("id", String(b.compte_id || "")).maybeSingle();
    const niveau = ["operateur", "gestionnaire", "direction"].includes(b.niveau) ? b.niveau : "gestionnaire";
    const c = compte || { id: "apercu", nom: "Aperçu", sites: b.site_id ? [String(b.site_id)] : [], niveaux: {} };
    const out = await charger(c, L.sitesAutorises(c, null), niveau);
    return json(req, { ok: true, apercu: true, contact: { nom: "Aperçu", niveau }, ...out });
  },
  async admin_envoyer(req, b) {
    const s = await session(req, "admin");
    if (!s) return json(req, { ok: false, session: false }, 401);
    const ids: string[] = (b.releves || []).map(String);
    await sb.from("releves").update({ envoyee_le: new Date().toISOString(), statut: "publiee" }).in("id", ids.length ? ids : ["__"]);
    const { data: cts } = await sb.from("client_contacts").select("id, nom, courriel").in("id", (b.contacts || []).map(String).concat("__")).eq("actif", true);
    const envoyes: string[] = [], aEnvoyer: string[] = [];
    for (const c of cts || []) {
      if (!c.courriel) continue;
      (await envoyerCourriel(c.courriel, String(b.sujet || "Rapport de visite"), `${b.texte || ""}\n\nConsulter le rapport : ${PORTAIL_URL}`) ? envoyes : aEnvoyer).push(c.courriel);
    }
    await journal(req, { identifiant: "sa-admin:" + s.contact_id, action: "envoi_client:" + ids.join(","), resultat: "ok" });
    return json(req, { ok: true, envoyes, aEnvoyer, portail: PORTAIL_URL });
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, message: "POST seulement" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const f = actions[String(b.action || "")];
    if (!f) return json(req, { ok: false, message: "Action inconnue" }, 400);
    return await f(req, b);
  } catch (e) {
    return json(req, { ok: false, message: "Erreur serveur : " + ((e as Error)?.message || String(e)) }, 500);
  }
});
