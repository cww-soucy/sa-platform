// Edge Function : logistique-courriel — courriel automatique aux responsables de l'entrepôt.
//  * Appelée par sa-admin et sa-terrain après une sortie d'inventaire émise (evenement « sortie ») ou un bon de livraison
//    confirmé (evenement « livraison »), avec le jeton de session du compte (Supabase Auth) : verify_jwt = true.
//  * Ne reçoit qu'un identifiant : la ligne et la liste des responsables sont relues ici (clé service), rien n'est pris du navigateur.
//  * Envoi direct (sa-terrain) : body.envoi = { responsables, moi } ; « moi » = courriel du compte connecté (table comptes).
//  * Responsables et événements : sa-admin › Logistique › Entrepôt (logistique_config, clé « entrepot_courriels »).
// Envoi : RESEND_API_KEY (+ LOGISTIQUE_FROM, sinon PORTAIL_FROM). Origines permises : LOGISTIQUE_ORIGINS (sinon PORTAIL_ORIGINS).
// Déploiement : supabase functions deploy logistique-courriel   (pas de --no-verify-jwt)
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as L from "./lib.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ORIGINES = (Deno.env.get("LOGISTIQUE_ORIGINS") || Deno.env.get("PORTAIL_ORIGINS") || "https://sa-platform.pages.dev").split(",").map((s) => s.trim());
const FROM = Deno.env.get("LOGISTIQUE_FROM") || Deno.env.get("PORTAIL_FROM") || "Soucy Aquatik <portail@soucyaquatik.com>";
const TABLE: Record<string, string> = { sortie: "sorties_inventaire", livraison: "bons_livraison" };

function cors(req: Request) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGINES.includes(o) ? o : ORIGINES[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, raison: "methode" }, 405);
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(jeton);
  if (!u?.user?.app_metadata?.compte_id) return json(req, { ok: false, raison: "session" }, 401);

  let b: any = {};
  try { b = await req.json(); } catch { /* corps vide */ }
  const evenement = String(b.evenement || ""), table = TABLE[evenement], id = String(b.id || "");
  if (!table || !id) return json(req, { ok: false, raison: "requete" }, 400);

  const { data: c } = await sb.from("logistique_config").select("value").eq("id", L.CLE).maybeSingle();
  const cfg = L.reglage(c?.value);
  // Envoi direct (sa-terrain › Sortie) : { responsables, moi } ; « moi » = courriel du compte connecté, relu ici
  const envoi = b.envoi && typeof b.envoi === "object" ? { responsables: !!b.envoi.responsables, moi: !!b.envoi.moi } : null;
  if (!envoi && !L.actif(cfg, evenement)) return json(req, { ok: false, raison: "desactive" });
  let moi = "";
  if (envoi?.moi) {
    const { data: cp } = await sb.from("comptes").select("email").eq("id", u.user.app_metadata.compte_id).maybeSingle();
    moi = cp?.email || "";
  }
  const a = L.destinatairesEnvoi(cfg, evenement, envoi, moi);
  if (!a.length) return json(req, { ok: false, raison: "aucun_destinataire" });

  const { data: r } = await sb.from(table).select("*").eq("id", id).maybeSingle();
  if (!r) return json(req, { ok: false, raison: "introuvable" }, 404);
  if (evenement === "livraison" && r.status !== "livre") return json(req, { ok: false, raison: "pas_livre" });

  if (!Deno.env.get("RESEND_API_KEY")) { console.error("logistique-courriel : RESEND_API_KEY absent"); return json(req, { ok: false, raison: "non_configure", a }); }
  const m = L.message(evenement, r);
  // Un courriel par destinataire : une adresse refusée (ex. compte Resend en mode test) n'empêche pas les autres
  const envoyes: string[] = [], echecs: string[] = [];
  for (const to of a) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: m.sujet, text: m.texte, html: m.html }),
    });
    if (res.ok) envoyes.push(to); else { echecs.push(to); console.error("resend", to, res.status, (await res.text()).slice(0, 300)); }
  }
  if (!envoyes.length) return json(req, { ok: false, raison: "envoi", a, echecs }, 502);
  console.log("logistique-courriel", evenement, id, "→", envoyes.length, "destinataire(s), par", u.user.app_metadata.compte_id);
  return json(req, { ok: true, a: envoyes, echecs });
});
