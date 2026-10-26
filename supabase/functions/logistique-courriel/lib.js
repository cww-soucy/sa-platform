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

/** L'événement est-il envoyé avec ce réglage ? */
export function actif(cfg, evenement) {
  return evenement === "sortie" ? cfg.sortie : evenement === "livraison" ? cfg.livraison : false;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Message pour une sortie d'inventaire (ligne sorties_inventaire) ou une livraison confirmée (ligne bons_livraison) */
export function message(evenement, r) {
  if (evenement === "sortie") {
    const lignes = (r.lignes || []).filter((l) => l && (l.desc || l.code));
    const sujet = `Sortie d'inventaire ${r.no_bon || ""} — ${r.client || "sans projet"}`.trim();
    const texte = [
      "Bonjour,", "",
      `Une sortie d'inventaire vient d'être émise${r.nom ? " par " + r.nom : ""}.`, "",
      `N° : ${r.no_bon || "—"}`, `Date : ${r.date || "—"}`, `Client / projet : ${r.client || "—"}`, `Employé : ${r.nom || "—"}${r.no_employe ? " (" + r.no_employe + ")" : ""}`, "",
      "Articles :",
      ...(lignes.length ? lignes.map((l) => `  • ${l.desc || l.code} — ${l.qteSortie || "?"}${l.unite ? " " + l.unite : ""}${l.loc ? " (empl. " + l.loc + ")" : ""}`) : ["  (aucun article)"]),
      "", "Message automatique — SA Platform, Soucy Aquatik",
    ].join("\n");
    const html = `<p>Une sortie d'inventaire vient d'être émise${r.nom ? " par <b>" + esc(r.nom) + "</b>" : ""}.</p>`
      + `<p><b>N° :</b> ${esc(r.no_bon || "—")}<br><b>Date :</b> ${esc(r.date || "—")}<br><b>Client / projet :</b> ${esc(r.client || "—")}</p>`
      + `<table cellpadding="4" style="border-collapse:collapse" border="1"><tr><th align="left">Article</th><th>Qté</th><th>Unité</th><th>Emplacement</th></tr>`
      + lignes.map((l) => `<tr><td>${esc(l.desc || l.code)}</td><td align="center">${esc(l.qteSortie)}</td><td>${esc(l.unite)}</td><td>${esc(l.loc)}</td></tr>`).join("")
      + `</table><p style="color:#666;font-size:12px">Message automatique — SA Platform, Soucy Aquatik</p>`;
    return { sujet, texte, html };
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
