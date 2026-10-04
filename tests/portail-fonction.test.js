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
