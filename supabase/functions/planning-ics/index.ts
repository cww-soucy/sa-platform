// Edge Function : planning-ics (v2)
// Flux calendrier iCalendar (.ics) personnel d'un employé, pour un abonnement webcal:// dans Outlook, Gmail, Apple Calendar.
// Accès par jeton opaque (tech_calendar_connections.ics_token), généré dans SA Platform ou sa-admin › Comptes.
// v2 (02/10) : heures au bon format (T080000 et non T08000000), tâches partagées entre plusieurs employés,
// bons de travail et créneaux inclus, journées entières de la bonne durée.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildIcs, eventsFor } from "./ics.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const iso = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return new Response("Jeton manquant", { status: 400 });
    const { data: conn } = await sb.from("tech_calendar_connections").select("emp, statut").eq("ics_token", token).eq("provider", "ics").maybeSingle();
    if (!conn || conn.statut !== "actif") return new Response("Jeton invalide ou révoqué", { status: 403 });
    const now = new Date(), from = iso(new Date(now.getTime() - 30 * 864e5)), to = iso(new Date(now.getTime() + 180 * 864e5));
    const like = "%" + conn.emp + "%";
    const [tasks, wos, plan, who] = await Promise.all([
      sb.from("planning_tasks").select("*").ilike("emp", like).lte("date_debut", to).gte("date_fin", from),
      sb.from("workorders").select("id,client,site,type,status,date,assigne,descr,updated_at").ilike("assigne", like).gte("date", from).lte("date", to),
      sb.from("plan").select("id,client,addr,date,heure,emp,descr,notes,status,updated_at").ilike("emp", like).gte("date", from).lte("date", to),
      sb.from("comptes_publics").select("prenom,nom").eq("id", conn.emp).maybeSingle(),
    ]);
    if (tasks.error || wos.error || plan.error) return new Response("Erreur de lecture du planning", { status: 500 });
    const nom = who.data ? `${who.data.prenom || ""} ${who.data.nom || ""}`.trim() : conn.emp;
    const body = buildIcs(eventsFor(conn.emp, { tasks: tasks.data, wos: wos.data, plan: plan.data }), nom);
    return new Response(body, { status: 200, headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="soucy-planning.ics"', "Cache-Control": "no-cache, max-age=0" } });
  } catch (e) {
    return new Response("Erreur serveur : " + ((e as Error)?.message || String(e)), { status: 500 });
  }
});
