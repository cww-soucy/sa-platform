'use strict';
// Flux calendrier (fonction serveur planning-ics) : format iCalendar valide, assignations exactes, contenu complet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mod = () => import(path.join(__dirname, '..', 'supabase', 'functions', 'planning-ics', 'ics.js'));

test('ics : heures au format RFC 5545 (T080000), journée entière de la bonne durée', async () => {
  const { buildIcs } = await mod();
  const s = buildIcs([{ uid: 'a', titre: 'Relevés, piscine', date_debut: '2026-10-02', heure_debut: '08:00', updated_at: '2026-10-01T10:00:00Z' },
    { uid: 'b', titre: 'Fermeture', date_debut: '2026-10-05', date_fin: '2026-10-07' }], 'Kaël Test');
  assert.match(s, /DTSTART;TZID=America\/Toronto:20261002T080000\r\n/);
  assert.match(s, /DTEND;TZID=America\/Toronto:20261002T090000\r\n/, 'durée d’une heure par défaut');
  assert.match(s, /DTSTART;VALUE=DATE:20261005\r\nDTEND;VALUE=DATE:20261008\r\n/, 'fin exclusive : lendemain du dernier jour');
  assert.match(s, /SUMMARY:Relevés\\, piscine/);
  assert.match(s, /X-WR-CALNAME:Soucy Aquatik — Kaël Test/);
  assert.ok(s.split('\r\n').every((l) => l.length <= 75 || /[^\x00-\x7f]/.test(l)), 'lignes pliées');
});

test('ics : tâches partagées, bons de travail et créneaux ; « kael » ≠ « kael2 »', async () => {
  const { eventsFor } = await mod();
  const ev = eventsFor('kael', {
    tasks: [{ id: 1, titre: 'Partagée', emp: 'kael2, kael', date_debut: '2026-10-02', date_fin: '2026-10-02', statut: 'assigne' },
      { id: 2, titre: 'Pas à lui', emp: 'kael2', date_debut: '2026-10-02', date_fin: '2026-10-02', statut: 'assigne' },
      { id: 3, titre: 'Annulée', emp: 'kael', date_debut: '2026-10-02', date_fin: '2026-10-02', statut: 'annule' }],
    wos: [{ id: 'w1', client: 'Piscine Alpha', type: 'entretien', status: 'ouvert', date: '2026-10-03', assigne: 'kael' },
      { id: 'w2', client: 'Fini', status: 'complete', date: '2026-10-03', assigne: 'kael' }],
    plan: [{ id: 'p1', client: 'Piscine Beta', date: '2026-10-01', heure: '13:00', emp: 'kael', status: 'assigned' }],
  });
  assert.deepEqual(ev.map((e) => e.uid), ['pl-p1', 'pt-1', 'wo-w1']);
});
