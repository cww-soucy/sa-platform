'use strict';
// Fonction serveur « portail » (logique pure) : jetons, codes, identifiants, droits, filtrage des données client.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const mod = () => import(path.join(__dirname, '..', 'supabase', 'functions', 'portail', 'lib.js'));

test('portail : jetons ≥ 128 bits, codes à 6 chiffres, empreintes comparées en temps constant', async () => {
  const L = await mod();
  const j = L.jeton(18);
  assert.ok(j.length >= 24 && /^[A-Za-z0-9_-]+$/.test(j));
  assert.notEqual(L.jeton(), L.jeton());
  for (let i = 0; i < 50; i++) assert.match(L.code6(), /^\d{6}$/);
  const h = await L.sha256('abc');
  assert.equal(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.ok(L.egal(h, h));
  assert.ok(!L.egal(h, h.slice(0, -1) + '0'));
});

test('portail : identifiant courriel / cellulaire normalisé et masqué', async () => {
  const L = await mod();
  assert.deepEqual(L.identifiant(' Jean@Ville.QC.ca '), { courriel: 'jean@ville.qc.ca' });
  assert.deepEqual(L.identifiant('+1 (819) 555-1234'), { cellulaire: '8195551234' });
  assert.equal(L.identifiant('bonjour'), null);
  assert.equal(L.masquer('jean@ville.qc.ca'), 'j•••••@ville.qc.ca');
  assert.ok(L.tropDeCodes(3, 0));
  assert.ok(L.tropDeCodes(0, 10));
  assert.ok(!L.tropDeCodes(2, 9));
});

test('portail : un contact ne voit que ses sites, selon son niveau', async () => {
  const L = await mod();
  const src = {
    sites: [{ id: 's1', nom: 'Piscine Alpha', bassins: [{ id: 'b1', nom: 'Grand bassin', plan_x: 40, plan_y: 30, plan_doc: 'd1' }] }, { id: 's2', nom: 'Autre client' }],
    releves: [
      { id: 'r1', site_id: 's1', date: '2026-10-03', statut: 'publiee', vals: { ph: 7.4 }, points: { p: { etat: 'action', note: 'Fuite', photos: ['x'], wo_id: 'w1' } }, resume: 'Résumé', tech_nom: 'Kaël' },
      { id: 'r2', site_id: 's1', date: '2026-10-04', statut: 'brouillon', vals: {} },
      { id: 'r3', site_id: 's2', date: '2026-10-03', vals: {} },
      { id: 'r4', site_id: 's1', date: '2026-06-01', vals: {} }],
    workorders: [{ site: 'Piscine Alpha', date: '2026-10-05', type: 'réparation', status: 'ouvert', descr: 'interne' }, { client: 'Autre client', date: '2026-10-05', status: 'ouvert' }],
    documents: [{ id: 'd1', titre: 'Plan', type: 'plan', site_id: 's1', portee: 'site', visibilite: 'operateur' },
      { id: 'd2', titre: 'Contrat', type: 'contrat', site_id: 's1', portee: 'site', visibilite: 'direction' },
      { id: 'd3', titre: 'Note interne', type: 'autre', site_id: 's1', portee: 'site', visibilite: 'interne' },
      { id: 'd4', titre: 'Plan autre', type: 'plan', site_id: 's2', portee: 'site', visibilite: 'operateur' }],
  };
  const now = new Date('2026-10-04T12:00:00Z');
  const op = L.donneesClient(src, { niveau: 'operateur', sitesOk: ['s1'], maintenant: now });
  assert.deepEqual(op.sites.map((s) => s.id), ['s1']);
  assert.deepEqual(op.releves.map((r) => r.id), ['r1'], 'brouillons, autres sites et vieux relevés exclus');
  assert.equal(op.releves[0].points.p.note, undefined, 'notes et photos : niveau rapports seulement');
  assert.equal(op.releves[0].resume, '');
  assert.deepEqual(op.interventions, []);
  assert.deepEqual(op.documents.map((d) => d.id), ['d1']);
  const ge = L.donneesClient(src, { niveau: 'gestionnaire', sitesOk: ['s1'], maintenant: now });
  assert.deepEqual(ge.releves.map((r) => r.id), ['r1', 'r4']);
  assert.equal(ge.releves[0].points.p.note, 'Fuite');
  assert.equal(ge.interventions.length, 1);
  assert.equal(ge.interventions[0].descr, undefined, 'aucune description interne');
  assert.deepEqual(L.donneesClient(src, { niveau: 'direction', sitesOk: ['s1'], maintenant: now }).documents.map((d) => d.id), ['d1', 'd2']);
  assert.deepEqual(L.sitesAutorises({ sites: ['s1', 's2'] }, { sites: ['s2'] }), ['s2']);
  assert.deepEqual(L.sitesAutorises({ sites: ['s1', 's2'] }, { sites: null }), ['s1', 's2']);
});

test('portail : sa-admin n’écrit que les colonnes permises', async () => {
  const L = await mod();
  const r = L.filtrerLigne('client_contacts', { id: 'c1', compte_id: 'k', nom: 'Jean', courriel: 'Jean@X.ca', cellulaire: '819-555-1234', niveau: 'direction', role: 'admin' });
  assert.equal(r.courriel, 'jean@x.ca');
  assert.equal(r.cellulaire, '8195551234');
  assert.equal(r.role, undefined);
  assert.equal(L.filtrerLigne('client_sessions', { id: 'x' }), null);
  assert.equal(L.nomFichier('Plan salle mécanique (v2).pdf'), 'Plan_salle_mecanique_v2_.pdf');
});

test('portail : un même courriel suit des sites de plusieurs comptes (sa liste de sites fait foi)', async () => {
  const L = await mod();
  assert.deepEqual(L.sitesAutorises({ sites: ['s1'] }, { sites: ['s1', 'x9'] }), ['s1', 'x9'], 'site d’un autre compte donné à la personne');
  assert.deepEqual(L.sitesAutorises({ sites: ['s1', 's2'] }, { sites: [] }), ['s1', 's2'], 'sans liste : les sites du compte');
  assert.deepEqual(L.sitesAutorises(null, { sites: [] }), []);
});

test('portail : niveau « saisie » (employé du client) — aucun droit de lecture, saisie permise, ses tests visibles', async () => {
  const L = await mod();
  assert.equal(L.peutSaisir('saisie'), true);
  assert.equal(L.peutSaisir('gestionnaire'), false);
  assert.ok(Object.values(L.droits('saisie', {})).every((v) => v === false));
  const src = { sites: [{ id: 's1', nom: 'A', bassins: [] }], releves: [
    { id: 'r1', site_id: 's1', date: '2026-10-20', statut: 'publiee', vals: { ph: 7.4 } },
    { id: 'r2', site_id: 's1', date: '2026-10-25', heure: '09:10', statut: 'client', vals: { ph: 7.2 }, tech_nom: 'Paul' },
    { id: 'r3', site_id: 'autre', date: '2026-10-25', statut: 'client', vals: {} }], documents: [{ id: 'd', visibilite: 'operateur', site_id: 's1', type: 'rapport' }] };
  const d = L.donneesClient(src, { niveau: 'saisie', droitsCompte: {}, sitesOk: ['s1'], maintenant: new Date('2026-10-26T12:00:00Z') });
  assert.equal(d.saisie, true);
  assert.deepEqual(d.tests.map((t) => t.id), ['r2'], 'ses tests, sur ses sites seulement');
  assert.deepEqual(d.releves.map((r) => r.vals), [{}], 'les relevés publiés ne montrent aucune valeur');
  assert.deepEqual(d.documents, [], 'aucun document');
  const g = L.donneesClient(src, { niveau: 'gestionnaire', droitsCompte: {}, sitesOk: ['s1'], maintenant: new Date('2026-10-26T12:00:00Z') });
  assert.equal(g.saisie, false);
  assert.deepEqual(g.tests.map((t) => t.id), ['r2'], 'le gestionnaire voit les tests de ses employés');
  assert.ok(!g.releves.some((r) => r.id === 'r2'), 'un test client n’est jamais une visite publiée');
});

test('portail : test d’eau saisi → ligne « releves » au statut client, valeurs contrôlées', async () => {
  const L = await mod();
  const T = { code: 'GEN', fields: [{ key: 'ph', label: 'pH' }, { key: 'cl', label: 'Chlore libre' }] };
  const contact = { id: 'ct-1', nom: 'Paul' }, site = { id: 's1', nom: 'Piscine A', bassins: [{ nom: 'Grand bassin' }, { nom: 'Pataugeoire' }] };
  const t0 = new Date('2026-10-26T13:05:00Z');
  assert.match(L.releveClient(T, { vals: { ph: '7,4' } }, { contact, site, maintenant: t0, id: 'x' }).erreur, /bassin/);
  assert.match(L.releveClient(T, { bassin: 'Pataugeoire', vals: {} }, { contact, site, maintenant: t0, id: 'x' }).erreur, /au moins une mesure/);
  assert.match(L.releveClient(T, { bassin: 'Pataugeoire', vals: { ph: 'abc' } }, { contact, site, maintenant: t0, id: 'x' }).erreur, /pH/);
  const { row } = L.releveClient(T, { bassin: 'Pataugeoire', vals: { ph: '7,4', cl: '1.5', inconnu: '9' }, note: 'ok' }, { contact, site, maintenant: t0, id: 'x' });
  assert.deepEqual(row.vals, { ph: 7.4, cl: 1.5 }, 'seuls les champs du type, en nombres');
  assert.deepEqual([row.statut, row.source, row.tech_nom, row.saisi_par, row.bassin, row.site_id], ['client', 'client', 'Paul', 'ct-1', 'Pataugeoire', 's1']);
  assert.deepEqual([row.date, row.heure], ['2026-10-26', '09:05'], 'date et heure de Montréal');
  const un = L.releveClient(T, { vals: { ph: 7 } }, { contact, site: { id: 's2', nom: 'B', bassins: [{ nom: 'Seul' }] }, maintenant: t0, id: 'y' }).row;
  assert.equal(un.bassin, 'Seul', 'un seul bassin : choisi d’office');
});

test('portail : test d’eau sans connexion — employé, bassin, trousse et BECSys, date et heure du serveur', async () => {
  const L = await mod();
  const site = { id: 's1', nom: 'Piscine A', bassins: [{ nom: 'Grand bassin' }, { nom: 'Pataugeoire' }] }, t0 = new Date('2026-10-26T13:05:00Z');
  const o = { site, cles: ['ph', 'cl'], maintenant: t0, id: 'tl1', typeCode: 'MI' };
  assert.match(L.testLibre({ bassin: 'Pataugeoire', mesures: { ph: 7 } }, o).erreur, /nom de l’employé/);
  assert.match(L.testLibre({ employe: 'Paul', mesures: { ph: 7 } }, o).erreur, /bassin testé/);
  assert.match(L.testLibre({ employe: 'Paul', bassin: 'Pataugeoire', mesures: {} }, o).erreur, /au moins une mesure/);
  assert.match(L.testLibre({ employe: 'Paul', bassin: 'Pataugeoire', mesures: { ph: '15' } }, o).erreur, /pH \(0 à 14\)/);
  assert.match(L.testLibre({ employe: 'Paul', bassin: 'Pataugeoire', mesures: { becsys_mv: '-3' } }, o).erreur, /mV/);
  const { row } = L.testLibre({ employe: '  Paul   Tremblay ', bassin: 'Pataugeoire', mesures: { ph: '7,4', cl: '1.5', becsys_mv: '720', becsys_ppm: '1,4', becsys_ph: '7.5', autre: '9' } }, o);
  assert.deepEqual(row.vals, { ph: 7.4, cl: 1.5, becsys_mv: 720, becsys_ppm: 1.4, becsys_ph: 7.5 });
  assert.deepEqual([row.tech_nom, row.bassin, row.statut, row.source, row.type_code, row.site_id], ['Paul Tremblay', 'Pataugeoire', 'client', 'carnet', 'MI', 's1']);
  assert.deepEqual([row.date, row.heure], ['2026-10-26', '09:05'], 'heure de Montréal, mise par le serveur');
  const je = L.testLibre({ employe: 'Paul', mesures: { cl: 0.8 } }, { site: { id: 's2', nom: 'Jeux', bassins: [{ nom: 'Jeux d’eau' }] }, cles: ['clr', 'ph'], id: 'x' }).row;
  assert.deepEqual([je.vals, je.bassin], [{ clr: 0.8 }, 'Jeux d’eau'], 'jeux d’eau : chlore résiduel ; un seul bassin choisi d’office');
});
