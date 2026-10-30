// Courriels automatiques à l'entrepôt — fonctions pures (testées par tests/logistique-courriel.test.js, utilisées par index.ts).
// Les responsables de l'entrepôt sont réglés dans sa-admin › Logistique › Entrepôt (logistique_config, clé « entrepot_courriels »).

export const CLE = "entrepot_courriels";
const COURRIEL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Réglage lu en base → { responsables: [{ nom, courriel }], sortie, livraison } (sortie : oui par défaut, livraison : non) */
export function reglage(v) {
  const o = v && typeof v === "object" ? v : {};
  const responsables = (Array.isArray(o.responsables) ? o.responsables : [])
    .map((r) => ({ nom: String((r && r.nom) || "").trim(), courriel: String((r && r.courriel) || "").trim().toLowerCase() }))
    .filter((r) => r.nom || r.courriel);
  return { responsables, sortie: o.sortie !== false, livraison: !!o.livraison };
}

/** Courriels valides, sans doublon */
export function destinataires(cfg) {
  const out = [];
  for (const r of cfg.responsables) if (COURRIEL.test(r.courriel) && !out.includes(r.courriel)) out.push(r.courriel);
  return out;
}

/** Courriel valide (forme seulement) */
export function courrielValide(c) { return COURRIEL.test(String(c || "").trim()); }

/**
 * Destinataires d'un envoi. Sans « envoi » (appel automatique, sa-admin) : responsables si l'événement est activé.
 * Avec « envoi » (envoi direct choisi par le technicien, sortie seulement) : responsables cochés et/ou l'adresse du compte
 * connecté (« moi » : relue en base par le serveur, jamais prise du navigateur) — le choix explicite passe outre l'interrupteur.
 */
export function destinatairesEnvoi(cfg, evenement, envoi, moi) {
  if (!envoi || typeof envoi !== "object" || evenement !== "sortie") return actif(cfg, evenement) ? destinataires(cfg) : [];
  const out = envoi.responsables ? destinataires(cfg) : [];
  const m = String(moi || "").trim().toLowerCase();
  if (envoi.moi && COURRIEL.test(m) && !out.includes(m)) out.push(m);
  return out;
}

/** L'événement est-il envoyé avec ce réglage ? */
export function actif(cfg, evenement) {
  return evenement === "sortie" ? cfg.sortie : evenement === "livraison" ? cfg.livraison : false;
}

/** Date et heure d'émission (sent_at, sinon date seule) : AAAA-MM-JJ HH:MM */
export function quand(r, opts = {}) {
  if (r.sent_at) {
    const d = new Date(r.sent_at);
    if (!isNaN(d)) {
      const p = Object.fromEntries(new Intl.DateTimeFormat("fr-CA", { ...opts, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
      return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
    }
  }
  return r.date || "—";
}
/** ODT de la sortie : rangé dans ses lignes (colonne absente de sorties_inventaire) */
export function odtDe(r) { return String(((r.lignes || []).find((l) => l && l.odt) || {}).odt || "").trim(); }
const qte = (l) => String(l.qteSortie == null || l.qteSortie === "" ? "?" : l.qteSortie) + (l.unite ? " " + l.unite : "");
/** Courriel texte d'une sortie — même format que « Courriel à l'entrepôt » de sa-admin */
export function sortieTexte(r, opts = {}) {
  const lignes = (r.lignes || []).filter((l) => l && (l.desc || l.code)), odt = odtDe(r), q = quand(r, opts);
  const w = Math.max(30, ...lignes.map((l) => String(l.desc || l.code).length + 8));
  const texte = [
    "Bonjour,", "",
    `Sortie d’inventaire émise${r.nom ? " par " + r.nom : ""}.`, "",
    `N° : ${r.no_bon || "—"}`, `Date : ${q}`, `Client / projet : ${r.client || "—"}`, `ODT : ${odt || "—"}`, "",
    "Articles :".padEnd(w) + "Quantités :".padEnd(14) + "Emp :",
    ...(lignes.length ? lignes.map((l) => ("• " + (l.desc || l.code) + " /").padEnd(w) + qte(l).padEnd(14) + (l.loc || "—")) : ["(aucun article)"]),
    "", "Soucy Aquatik",
  ].join("\n");
  return { sujet: `Sortie d’inventaire ${r.no_bon || ""} — ${r.client || "sans projet"}${odt ? " — ODT " + odt : ""}`, texte, quand: q, odt };
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Message pour une sortie d'inventaire (ligne sorties_inventaire) ou une livraison confirmée (ligne bons_livraison) */
export function message(evenement, r) {
  if (evenement === "sortie") {
    const lignes = (r.lignes || []).filter((l) => l && (l.desc || l.code));
    const t = sortieTexte(r, { timeZone: "America/Toronto" });
    const html = `<p>Bonjour,</p><p>Sortie d’inventaire émise${r.nom ? " par <b>" + esc(r.nom) + "</b>" : ""}.</p>`
      + `<p><b>N° :</b> ${esc(r.no_bon || "—")}<br><b>Date :</b> ${esc(t.quand)}<br><b>Client / projet :</b> ${esc(r.client || "—")}<br><b>ODT :</b> ${esc(t.odt || "—")}</p>`
      + `<table cellpadding="5" style="border-collapse:collapse" border="1"><tr><th align="left">Articles</th><th>Quantités</th><th>Emp</th></tr>`
      + lignes.map((l) => `<tr><td>${esc(l.desc || l.code)}</td><td align="center">${esc(qte(l))}</td><td align="center">${esc(l.loc || "—")}</td></tr>`).join("")
      + `</table><p>Soucy Aquatik</p>`;
    return { sujet: t.sujet, texte: t.texte, html };
  }
  const items = (r.items_liv || []).filter((i) => i && i.item);
  const signe = (r.photos || []).some((p) => p && /^Signature/.test(p.name || ""));
  const sujet = `Livraison confirmée ${r.no_bon || ""} — ${r.client || ""}`.trim();
  const quand = r.livre_at ? new Date(r.livre_at).toLocaleString("fr-CA", { timeZone: "America/Toronto" }) : "—";
  const texte = [
    "Bonjour,", "",
    `Le bon de livraison ${r.no_bon || ""} a été confirmé${r.livre_par_nom ? " par " + r.livre_par_nom : ""} (${signe ? "signé par le client" : "sans signature"}).`, "",
    `Client : ${r.client || "—"}`, `Adresse : ${r.adresse || "—"}`, `Livré le : ${quand}`, "",
    "Articles livrés :",
    ...(items.length ? items.map((i) => `  • ${i.item} — ${i.qteLivree || i.qteSortie || "?"}${i.unite ? " " + i.unite : ""}`) : ["  (aucun article)"]),
    "", "Message automatique — SA Platform, Soucy Aquatik",
  ].join("\n");
  const html = `<p>Le bon de livraison <b>${esc(r.no_bon)}</b> a été confirmé${r.livre_par_nom ? " par " + esc(r.livre_par_nom) : ""} (${signe ? "signé par le client" : "sans signature"}).</p>`
    + `<p><b>Client :</b> ${esc(r.client || "—")}<br><b>Adresse :</b> ${esc(r.adresse || "—")}<br><b>Livré le :</b> ${esc(quand)}</p>`
    + `<ul>${items.map((i) => `<li>${esc(i.item)} — ${esc(i.qteLivree || i.qteSortie)} ${esc(i.unite)}</li>`).join("")}</ul>`
    + `<p style="color:#666;font-size:12px">Message automatique — SA Platform, Soucy Aquatik</p>`;
  return { sujet, texte, html };
}
