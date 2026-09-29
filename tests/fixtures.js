// Données de test synthétiques, à la forme des vraies tables (types_bassin reprend la structure réelle).
'use strict';
const { today, weekKey, dayIdx, iso, addDays } = require('./harness');

const PH = { key: 'ph', label: 'pH', unit: '', kind: 'range', icon: 'flask', min: 6.8, max: 8.2, lo: 7.2, hi: 7.6, step: 0.1 };
const CL = { key: 'cl', label: 'Chlore libre', unit: 'mg/L', kind: 'range', icon: 'flask', min: 0, max: 5, lo: 1, hi: 3, step: 0.1 };

function emptyWeek() { return Array.from({ length: 7 }, () => ({ status: 'idle', tasks: [], saved: false, kmArr: '', stopFiles: [], del: [] })); }

function base() {
  const t = today(), wk = weekKey(), di = dayIdx(), hier = iso(addDays(new Date(), -1));
  const days = emptyWeek();
  days[di].tasks.push({ id: 1, lieu: 'Entrepôt', start: '07:00', end: '08:00', hrs: 1, active: false, pendingValidation: true, pendingReason: 'entrepot_bureau' });
  return {
    types_bassin: [
      { code: 'GEN', label: 'Bassin générique', court: 'Générique', norme: '', fields: [PH, CL], checks: ['Skimmers nettoyés'], produits: [['Hypochlorite de sodium 12 %', 'L', 0.5]] },
      { code: 'MI', label: 'Piscine municipale intérieure', court: 'Municipale int.', norme: 'Q-2, r. 39', fields: [PH, CL], checks: [], produits: [] },
    ],
    sites: [
      { id: 1, nom: 'Piscine Alpha', addr: '1 rue A, Québec', notes: '' },
      { id: 2, nom: 'Piscine Beta', addr: '2 rue B, Lévis', notes: '' },
      { id: 3, nom: 'Vieux doublon', addr: '', notes: 'Fusionné → Piscine Alpha [1] le 2026-09-01.' },
      { id: 4, nom: 'Piscine Alpha Sud', addr: '', notes: 'Ajouté automatiquement depuis un punch.' },
    ],
    contrats: [{ site_id: 1, type_code: 'MI', code: 'C-001' }],
    comptes_publics: [
      { id: 'kael', prenom: 'Kaël', nom: 'Test', role: 'technicien', dept: 'Terrain', tel: '418-555-0101' },
      { id: 'kael2', prenom: 'Autre', nom: 'Tech', role: 'technicien', dept: 'Terrain', tel: '' },
      { id: 'cwweil', prenom: 'Bureau', nom: 'SA', role: 'admin', dept: 'Bureau', tel: '418-555-0100' },
    ],
    comptes: [{ id: 'kael', statut: 'actif' }, { id: 'kael2', statut: 'actif' }],
    feuilles_temps: [{ id: 'kael_' + wk, uid: 'kael', emp: 'Kaël Test', week: wk, days, total_h: 1, updated_at: '2026-01-01T00:00:00Z' }],
    workorders: [
      { id: 'wo-mine', client: 'Piscine Alpha', site: '1 rue A, Québec', type: 'entretien', priorite: 'normal', status: 'ouvert', date: t, assigne: 'kael', descr: 'Entretien hebdo', groupe_id: null },
      { id: 'wo-other', client: 'Piscine Beta', site: '2 rue B, Lévis', type: 'entretien', priorite: 'urgent', status: 'ouvert', date: t, assigne: 'kael2', descr: 'Pas pour Kaël', groupe_id: null },
    ],
    plan: [], planning_tasks: [],
    releves: [{ id: 'r1', site_id: 1, site_nom: 'Piscine Alpha', tech: 'kael', tech_nom: 'Kaël Test', date: hier, heure: '10:00', type_code: 'MI', vals: { ph: 7.9, cl: 2 }, touched: { ph: 1, cl: 1 }, checks: {}, prods: {}, note: null, hors_zone: 1 }],
    punch_gps_log: [
      { id: 'g1', site_id: 1, emp: 'Kaël Test', lat: 46.81, lng: -71.21, acc: 10, date: t, heure: '09:15', lieu: 'Piscine Alpha' },
      { id: 'g2', site_id: 2, emp: 'Autre Tech', lat: 46.80, lng: -71.18, acc: 12, date: t, heure: '08:30', lieu: 'Piscine Beta' },
    ],
    demandes: [{ id: 'd1', tech: 'kael', tech_nom: 'Kaël Test', site_nom: 'Piscine Beta', type: 'Matériel', motif: 'Trousse DPD', texte: 'Trousse DPD', statut: 'Envoyée', created_at: new Date(hier + 'T16:00:00').toISOString() }],
    facturation: [{ id: 'f1', id_projet: 'P1', client: 'Ville X', ville: 'Québec', date: t, odt: 'ODT-1', po: null, prix_calcule: 1000, prix_facture: 1200, statut_facturation: 'À facturer', technicien: 'kael' }],
    projets_excel: [{ id_projet: 'P1', nom: 'Projet 1' }],
    sondages: [],
    inventaire: [
      { id: 'i1', nom: 'Chlore liquide 20 L', unite: 'bidon', qte: 12, categorie: 'chimique' },
      { id: 'i2', nom: 'Bicarbonate de sodium', unite: 'sac', qte: 8, categorie: 'chimique' },
      { id: 'i3', nom: 'Joint torique 2 po', unite: 'u', qte: 30, categorie: 'piece' },
    ],
    bons_livraison: [
      { id: 'bl-a', no_bon: 'SA-20260928-111', client: 'Piscine Beta', tel: '', adresse: '2 rue B, Lévis', date: t, heure: '', technicien: 'Kaël Test', urgent: true, status: 'brouillon',
        items_liv: [{ item: 'Chlore liquide 20 L', qteSortie: '4', unite: 'bidon', qteLivree: '4', statut: '' }], items_ret: [], photos: [], created_by: 'cwweil' },
      { id: 'bl-b', no_bon: 'SA-20260901-222', client: 'Ancien client', status: 'livre', technicien: 'Kaël Test', items_liv: [], photos: [] },
    ],
    rapports_hivernage: [{ id: 'hv-old', site_id: '2', site_nom: 'Piscine Beta', status: 'brouillon', date_inspection: t, technicien: 'Kaël Test' }],
  };
}

module.exports = { base, emptyWeek, PH, CL };
