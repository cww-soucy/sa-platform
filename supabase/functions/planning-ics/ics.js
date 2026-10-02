// Construction du flux iCalendar — fonctions pures (testées par tests/ics.test.js, utilisées par index.ts).
export function icsEscape(s) {
  return String(s == null ? "" : s).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
// "2026-10-02" + "08:00" -> "20261002T080000" ; sans heure -> "20261002"
export function icsDate(d, h) {
  const day = String(d).slice(0, 10).replace(/-/g, "");
  if (!h || !/^\d{1,2}:\d{2}/.test(h)) return day;
  const [hh, mm] = h.split(":");
  return `${day}T${hh.padStart(2, "0")}${mm.slice(0, 2)}00`;
}
export function nextDay(d) {
  const t = new Date(String(d).slice(0, 10) + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
function addMinutes(h, m) {
  const [hh, mm] = h.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, hh * 60 + mm + m);
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}
function stamp(iso) {
  const d = iso ? new Date(iso) : new Date();
  return (isNaN(d) ? new Date() : d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
// Un employé est assigné si son identifiant figure dans la liste "kael, kael2" (pas une sous-chaîne : "kael" ≠ "kael2")
export function assigned(list, emp) {
  return String(list || "").split(/,\s*/).map((x) => x.trim()).filter(Boolean).includes(emp);
}
function line(k, v) {
  // pliage à 74 octets environ (RFC 5545 §3.1)
  const s = k + ":" + v, out = [];
  for (let i = 0; i < s.length; i += 73) out.push((i ? " " : "") + s.slice(i, i + 73));
  return out.join("\r\n");
}
// events : [{uid, titre, date_debut, date_fin, heure_debut, heure_fin, lieu, descr, updated_at}]
export function buildIcs(events, nom) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Soucy Aquatik//Planning//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    line("X-WR-CALNAME", icsEscape("Soucy Aquatik — " + (nom || "Mon planning"))), "X-WR-TIMEZONE:America/Toronto",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M", "X-PUBLISHED-TTL:PT30M"];
  for (const e of events) {
    const d0 = e.date_debut, d1 = e.date_fin || e.date_debut;
    L.push("BEGIN:VEVENT", line("UID", e.uid + "@sa-platform.pages.dev"), "DTSTAMP:" + stamp(e.updated_at));
    if (e.heure_debut) {
      const fin = e.heure_fin && (d1 > d0 || e.heure_fin > e.heure_debut) ? e.heure_fin : addMinutes(e.heure_debut, 60);
      L.push("DTSTART;TZID=America/Toronto:" + icsDate(d0, e.heure_debut), "DTEND;TZID=America/Toronto:" + icsDate(d1, fin));
    } else {
      L.push("DTSTART;VALUE=DATE:" + icsDate(d0), "DTEND;VALUE=DATE:" + icsDate(nextDay(d1)));
    }
    L.push(line("SUMMARY", icsEscape(e.titre || "Travail planifié")));
    if (e.descr) L.push(line("DESCRIPTION", icsEscape(e.descr)));
    if (e.lieu) L.push(line("LOCATION", icsEscape(e.lieu)));
    L.push("STATUS:CONFIRMED", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}
// Rassemble ce qui est assigné à l'employé : tâches planning, bons de travail, créneaux (fenêtre −30 j / +180 j)
export function eventsFor(emp, rows) {
  const out = [];
  for (const t of rows.tasks || []) {
    if (!assigned(t.emp, emp) || t.statut === "annule" || t.statut === "refuse") continue;
    out.push({ uid: "pt-" + t.id, titre: t.titre, date_debut: t.date_debut, date_fin: t.date_fin, heure_debut: t.heure_debut, heure_fin: t.heure_fin, lieu: t.site_nom, descr: t.descr, updated_at: t.updated_at || t.created_at });
  }
  for (const w of rows.wos || []) {
    if (!w.date || !assigned(w.assigne, emp) || ["termine", "complete", "facture"].includes(w.status)) continue;
    out.push({ uid: "wo-" + w.id, titre: "Bon de travail — " + (w.client || "") + (w.type ? " (" + w.type + ")" : ""), date_debut: w.date, lieu: [w.client, w.site].filter(Boolean).join(", "), descr: w.descr, updated_at: w.updated_at });
  }
  for (const p of rows.plan || []) {
    if (!p.date || !assigned(p.emp, emp) || p.status === "termine") continue;
    out.push({ uid: "pl-" + p.id, titre: "Créneau — " + (p.client || "") + (p.descr ? " : " + p.descr : ""), date_debut: p.date, heure_debut: p.heure || null, lieu: [p.client, p.addr].filter(Boolean).join(", "), descr: p.notes, updated_at: p.updated_at });
  }
  return out.sort((a, b) => (a.date_debut + (a.heure_debut || "")).localeCompare(b.date_debut + (b.heure_debut || "")));
}
