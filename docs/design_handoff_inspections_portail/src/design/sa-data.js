/* Soucy Aquatik — données de démonstration partagées (sa-terrain + sa-admin).
   Fictives mais réalistes : sites en Estrie / Centre-du-Québec, coordonnées GPS réelles des villes. */
(function () {
  const F = (key, label, unit, min, max, lo, hi, step, icon) => ({ key, label, unit, min, max, lo, hi, step, icon, kind: 'range' });
  const N = (key, label, unit, min, max, lo, hi, step) => ({ key, label, unit, min, max, lo, hi, step, kind: 'count' });

  const TYPES = {
    MI: {
      label: 'Piscine municipale intérieure', court: 'Municipale int.', norme: 'RQEP · relevé aux 4 h',
      fields: [
        F('ph', 'pH', '', 6.8, 8.2, 7.2, 7.6, 0.1, 'flask'),
        F('cl', 'Chlore libre', 'mg/L', 0, 4, 1.0, 2.0, 0.1, 'droplet'),
        F('clc', 'Chlore combiné', 'mg/L', 0, 1.2, 0, 0.5, 0.1, 'droplet'),
        F('alc', 'Alcalinité totale', 'ppm', 40, 200, 80, 120, 5, 'flask'),
        F('th', 'Dureté calcique', 'ppm', 100, 500, 200, 400, 10, 'flask'),
        F('temp', 'Température', '°C', 22, 34, 26, 28, 0.5, 'thermo'),
        F('tur', 'Turbidité', 'UTN', 0, 1.5, 0, 0.5, 0.1, 'eye'),
        F('psi', 'Pression filtre', 'psi', 0, 30, 8, 15, 1, 'gauge')
      ],
      checks: ['Drain principal visible du bord', 'Écumoires et préfiltres nettoyés', 'Registre RQEP signé', 'Trousse de premiers soins complète'],
      produits: [['Hypochlorite de sodium 12 %', 'L', 0.5], ['Bicarbonate de sodium', 'kg', 1], ['Acide muriatique', 'L', 0.5], ['Chlorure de calcium', 'kg', 1]],
      photo: 'Salle mécanique et bassin'
    },
    ME: {
      label: 'Piscine extérieure municipale', court: 'Municipale ext.', norme: 'RQEP · relevé 2× par jour',
      fields: [
        F('ph', 'pH', '', 6.8, 8.2, 7.2, 7.6, 0.1, 'flask'),
        F('cl', 'Chlore libre', 'mg/L', 0, 4, 1.0, 2.0, 0.1, 'droplet'),
        F('cya', 'Stabilisant (CYA)', 'ppm', 0, 100, 20, 50, 5, 'flask'),
        F('alc', 'Alcalinité totale', 'ppm', 40, 200, 80, 120, 5, 'flask'),
        F('temp', 'Température', '°C', 14, 32, 24, 28, 0.5, 'thermo'),
        F('niv', 'Niveau d\u2019eau sous margelle', 'cm', 0, 30, 12, 18, 1, 'waves'),
        F('psi', 'Pression filtre', 'psi', 0, 30, 8, 15, 1, 'gauge')
      ],
      checks: ['Débris et feuilles retirés', 'Clôture et portail verrouillables', 'Échelles et mains courantes fixées'],
      produits: [['Hypochlorite de sodium 12 %', 'L', 1], ['Stabilisant', 'kg', 0.5], ['Bicarbonate de sodium', 'kg', 1], ['Acide muriatique', 'L', 0.5]],
      photo: 'Bassin vu du bord profond'
    },
    RE: {
      label: 'Piscine résidentielle', court: 'Résidentielle', norme: 'Entretien hebdomadaire',
      fields: [
        F('ph', 'pH', '', 6.8, 8.2, 7.2, 7.6, 0.1, 'flask'),
        F('cl', 'Chlore libre', 'mg/L', 0, 5, 1, 3, 0.1, 'droplet'),
        F('alc', 'Alcalinité totale', 'ppm', 40, 200, 80, 120, 5, 'flask'),
        F('cya', 'Stabilisant (CYA)', 'ppm', 0, 100, 30, 50, 5, 'flask'),
        F('temp', 'Température', '°C', 14, 32, 25, 29, 0.5, 'thermo'),
        F('niv', 'Niveau d\u2019eau (mi-écumoire)', 'cm', 0, 30, 12, 18, 1, 'waves')
      ],
      checks: ['Paniers d\u2019écumoire vidés', 'Filtre lavé à contre-courant', 'Parois et fond brossés'],
      produits: [['Chlore choc granulaire', 'kg', 0.5], ['Galets de trichlore', 'u', 1], ['Bicarbonate de sodium', 'kg', 1], ['Clarifiant', 'mL', 50]],
      photo: 'Vue d\u2019ensemble de la cour'
    },
    JE: {
      label: 'Jeux d\u2019eau', court: 'Jeux d\u2019eau', norme: 'Eau potable · sans recirculation',
      fields: [
        F('clr', 'Chlore résiduel', 'mg/L', 0, 2, 0.2, 1.0, 0.05, 'droplet'),
        F('ph', 'pH', '', 6.5, 8.5, 7.0, 8.0, 0.1, 'flask'),
        F('pal', 'Pression d\u2019alimentation', 'psi', 20, 80, 40, 60, 1, 'gauge'),
        N('jets', 'Jets inopérants', 'sur 14', 0, 14, 0, 0, 1)
      ],
      checks: ['Bouton d\u2019activation / détecteur fonctionnel', 'Grilles de drain dégagées', 'Surface antidérapante nettoyée', 'Aucune pièce saillante ou brisée'],
      produits: [['Nettoyant de surface', 'L', 0.5], ['Buses de rechange', 'u', 1]],
      photo: 'Aire de jeu, jets en marche'
    },
    SP: {
      label: 'Spa commercial', court: 'Spa', norme: 'RQEP · spa · relevé aux 2 h',
      fields: [
        F('cl', 'Chlore libre', 'mg/L', 0, 10, 3, 5, 0.1, 'droplet'),
        F('ph', 'pH', '', 6.8, 8.2, 7.2, 7.8, 0.1, 'flask'),
        F('alc', 'Alcalinité totale', 'ppm', 40, 200, 80, 120, 5, 'flask'),
        F('temp', 'Température', '°C', 30, 41, 37, 39, 0.5, 'thermo'),
        N('vid', 'Jours depuis la vidange', 'j', 0, 60, 0, 30, 1)
      ],
      checks: ['Registre de baigneurs à jour', 'Couvercle et sangles en bon état', 'Jets et bouton d\u2019arrêt d\u2019urgence testés'],
      produits: [['Hypochlorite de sodium 12 %', 'L', 0.25], ['Bicarbonate de sodium', 'kg', 0.25], ['Antimousse', 'mL', 25]],
      photo: 'Spa, couvercle ouvert'
    },
    PA: {
      label: 'Pataugeoire', court: 'Pataugeoire', norme: 'RQEP · vidange quotidienne',
      fields: [
        F('cl', 'Chlore libre', 'mg/L', 0, 4, 1.0, 2.0, 0.1, 'droplet'),
        F('ph', 'pH', '', 6.8, 8.2, 7.2, 7.6, 0.1, 'flask'),
        F('temp', 'Température', '°C', 14, 30, 20, 26, 0.5, 'thermo'),
        F('tur', 'Turbidité', 'UTN', 0, 1.5, 0, 0.5, 0.1, 'eye'),
        F('niv', 'Profondeur', 'cm', 0, 60, 40, 46, 1, 'waves')
      ],
      checks: ['Vidange et nettoyage faits', 'Grille de fond fixée', 'Affichage de profondeur visible'],
      produits: [['Hypochlorite de sodium 12 %', 'L', 0.25], ['Acide muriatique', 'L', 0.25]],
      photo: 'Pataugeoire remplie'
    }
  };

  const TECHS = [
    { id: 'T1', nom: 'Maxime Tremblay', ini: 'MT', tel: '819 571-2201', statut: 'punché', site: 'S07', depuis: '08:02', lat: 45.4248, lng: -71.8480 },
    { id: 'T2', nom: 'Sophie Gagnon', ini: 'SG', tel: '819 571-2202', statut: 'punché', site: 'S08', depuis: '07:48', lat: 45.4010, lng: -72.7290 },
    { id: 'T3', nom: 'Jérémie Roy', ini: 'JR', tel: '819 571-2203', statut: 'punché', site: 'S01', depuis: '08:24', lat: 45.2689, lng: -72.1432 },
    { id: 'T4', nom: 'Camille Bélanger', ini: 'CB', tel: '819 571-2204', statut: 'en route', site: 'S10', depuis: '09:11', lat: 45.7420, lng: -72.3100 },
    { id: 'T5', nom: 'Olivier Côté', ini: 'OC', tel: '819 571-2205', statut: 'punché', site: 'S09', depuis: '08:40', lat: 45.4107, lng: -71.8870 },
    { id: 'T6', nom: 'Laurence Pelletier', ini: 'LP', tel: '819 571-2206', statut: 'pause', site: 'S11', depuis: '09:30', lat: 46.0560, lng: -71.9580 },
    { id: 'T7', nom: 'Samuel Lavoie', ini: 'SL', tel: '819 571-2207', statut: 'punché', site: 'S12', depuis: '08:15', lat: 45.3180, lng: -72.6480 },
    { id: 'T8', nom: 'Émile Fortin', ini: 'ÉF', tel: '819 571-2208', statut: 'congé', site: null, depuis: '', lat: null, lng: null }
  ];

  const S = (id, nom, client, ville, lat, lng, type, bassin, freq, tech, contrat) => ({ id, nom, client, ville, lat, lng, type, bassin, freq, tech, contrat });
  const SITES = [
    S('S01', 'Centre aquatique de Magog', 'Ville de Magog', 'Magog', 45.2689, -72.1432, 'MI', '25 m · 6 couloirs · 520 m³', 'Lun · mer · jeu', 'T3', 'C-26-014'),
    S('S02', 'Résidence Bergeron', 'Mme Nathalie Bergeron', 'North Hatley', 45.2771, -71.9738, 'RE', 'Creusée 16 × 32 pi · 75 m³', 'Tous les jeudis', 'T3', 'R-26-208'),
    S('S03', 'Spa — Hôtel Le Montagnard', 'Hôtel Le Montagnard', 'Orford', 45.3480, -72.2410, 'SP', 'Spa 8 places · 4 m³', 'Lun · jeu', 'T3', 'C-26-031'),
    S('S04', 'Jeux d\u2019eau du parc des Braves', 'Ville de Magog', 'Magog', 45.2621, -72.1520, 'JE', '14 jets · eau potable', 'Tous les jeudis', 'T3', 'C-26-014'),
    S('S05', 'Piscine du parc Quintal', 'Ville de Sherbrooke', 'Sherbrooke', 45.4125, -71.8752, 'ME', 'Extérieure 25 m · 610 m³', 'Mar · jeu', 'T3', 'C-26-009'),
    S('S06', 'Pataugeoire du parc Victoria', 'Ville de Sherbrooke', 'Sherbrooke', 45.3951, -71.9003, 'PA', '0,45 m · 38 m³', 'Quotidien (saison)', 'T3', 'C-26-009'),
    S('S07', 'Centre de natation Fleurimont', 'Ville de Sherbrooke', 'Sherbrooke', 45.4248, -71.8480, 'MI', '25 m · 8 couloirs · 690 m³', 'Lun au ven', 'T1', 'C-26-009'),
    S('S08', 'Complexe aquatique de Granby', 'Ville de Granby', 'Granby', 45.4010, -72.7290, 'MI', '50 m · 10 couloirs · 1 900 m³', 'Lun au ven', 'T2', 'C-26-022'),
    S('S09', 'Piscine du Cégep de Sherbrooke', 'Cégep de Sherbrooke', 'Sherbrooke', 45.4107, -71.8870, 'MI', '25 m · 6 couloirs · 480 m³', 'Lun · mer · ven', 'T5', 'C-26-040'),
    S('S10', 'Centre aquatique de Drummondville', 'Ville de Drummondville', 'Drummondville', 45.8810, -72.4930, 'MI', '25 m · 8 couloirs · 720 m³', 'Mar · jeu', 'T4', 'C-26-027'),
    S('S11', 'Piscine Cartier', 'Ville de Victoriaville', 'Victoriaville', 46.0560, -71.9580, 'ME', 'Extérieure 25 m · 540 m³', 'Mar · jeu', 'T6', 'C-26-035'),
    S('S12', 'Spa nordique Bromont', 'Bromont Villégiature', 'Bromont', 45.3180, -72.6480, 'SP', '3 bassins · 22 m³', 'Lun · mer · ven', 'T7', 'C-26-044'),
    S('S13', 'Jeux d\u2019eau du parc Jacques-Cartier', 'Ville de Sherbrooke', 'Sherbrooke', 45.3995, -71.9005, 'JE', '22 jets · eau potable', 'Lun · jeu', 'T1', 'C-26-009'),
    S('S14', 'Résidence Lapointe', 'M. Éric Lapointe', 'Magog', 45.2550, -72.1230, 'RE', 'Hors-terre 24 pi · 45 m³', 'Tous les mardis', 'T1', 'R-26-211'),
    S('S15', 'Condos Les Berges du lac', 'Syndicat Les Berges', 'Magog', 45.2600, -72.1600, 'ME', 'Extérieure 12 × 6 m · 110 m³', 'Lun · ven', 'T1', 'C-26-051'),
    S('S16', 'Piscine municipale de Coaticook', 'Ville de Coaticook', 'Coaticook', 45.1350, -71.8040, 'ME', 'Extérieure 25 m · 480 m³', 'Mar · ven', 'T5', 'C-26-038'),
    S('S17', 'Pataugeoire du parc Laurier', 'Ville de Granby', 'Granby', 45.4050, -72.7200, 'PA', '0,40 m · 30 m³', 'Quotidien (saison)', 'T2', 'C-26-022'),
    S('S18', 'Jeux d\u2019eau du parc Woodyatt', 'Ville de Drummondville', 'Drummondville', 45.8870, -72.4800, 'JE', '18 jets · eau potable', 'Mar · jeu', 'T4', 'C-26-027'),
    S('S19', 'Résidence Tanguay', 'M. et Mme Tanguay', 'Bromont', 45.3200, -72.6600, 'RE', 'Creusée 18 × 36 pi · 90 m³', 'Tous les mercredis', 'T7', 'R-26-219'),
    S('S20', 'Spa — Auberge du lac Massawippi', 'Auberge du lac Massawippi', 'North Hatley', 45.2850, -71.9650, 'SP', 'Spa 6 places · 3 m³', 'Mar · ven', 'T5', 'C-26-047'),
    S('S21', 'Piscine intérieure de Windsor', 'Ville de Windsor', 'Windsor', 45.5680, -71.9990, 'MI', '25 m · 5 couloirs · 410 m³', 'Lun · jeu', 'T6', 'C-26-036'),
    S('S22', 'Pataugeoire du parc Lucien-Blanchard', 'Ville de Sherbrooke', 'Sherbrooke', 45.3880, -71.8850, 'PA', '0,45 m · 34 m³', 'Quotidien (saison)', 'T1', 'C-26-009')
  ];

  // Salles mécaniques (sites avec recirculation)
  const SALLES = {
    S01: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '118 m³/h' },
    S03: { pompe: 'ok', filtre: 'ok', dosage: 'attn', debit: '9 m³/h', note: 'Chlore bas au dernier relevé' },
    S05: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '140 m³/h' },
    S07: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '160 m³/h' },
    S08: { pompe: 'ok', filtre: 'ok', dosage: 'alerte', debit: '410 m³/h', note: 'Pompe doseuse chlore — débit nul depuis 07:12' },
    S09: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '112 m³/h' },
    S10: { pompe: 'ok', filtre: 'attn', dosage: 'ok', debit: '150 m³/h', note: 'Pression filtre 21 psi — lavage requis' },
    S11: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '125 m³/h' },
    S12: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '38 m³/h' },
    S15: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '30 m³/h' },
    S16: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '110 m³/h' },
    S20: { pompe: 'ok', filtre: 'ok', dosage: 'ok', debit: '7 m³/h' },
    S21: { pompe: 'attn', filtre: 'ok', dosage: 'ok', debit: '96 m³/h', note: 'Bruit de roulement signalé' }
  };

  // Historique des relevés — générateur déterministe
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const DAYS = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(2026, 9, 1); d.setDate(d.getDate() - i); DAYS.push(d); }
  const fmtD = d => d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
  const HIST = {};
  SITES.forEach((s, si) => {
    const r = rng(1000 + si * 77);
    HIST[s.id] = {};
    TYPES[s.type].fields.forEach((f, fi) => {
      const mid = (f.lo + f.hi) / 2, span = Math.max(f.hi - f.lo, f.step * 4);
      let v = mid;
      HIST[s.id][f.key] = DAYS.map((d, di) => {
        v = v + (r() - 0.5) * span * 0.5;
        v = v + (mid - v) * 0.35;
        if (r() < 0.06) v = r() < 0.5 ? f.lo - span * 0.35 : f.hi + span * 0.3;
        v = Math.min(f.max, Math.max(f.min, v));
        const q = Math.round(v / f.step) * f.step;
        return { d: fmtD(d), v: +q.toFixed(2) };
      });
    });
  });
  // Écarts connus aujourd'hui
  const setLast = (sid, key, v) => { const a = HIST[sid][key]; a[a.length - 1].v = v; };
  setLast('S03', 'cl', 1.8); setLast('S08', 'clc', 0.7); setLast('S05', 'ph', 7.9); setLast('S10', 'psi', 21);

  // Tournée du jour — Jérémie Roy (T3), jeudi 1er octobre 2026
  const TOURNEE = [
    { id: 'J1', site: 'S02', h: '07:10', fin: '07:55', statut: 'fait', tache: 'Entretien hebdomadaire', rec: 'Tous les jeudis' },
    { id: 'J2', site: 'S01', h: '08:20', fin: '', statut: 'en cours', tache: 'Relevés RQEP + contrôle salle mécanique', rec: 'Lun · mer · jeu' },
    { id: 'J3', site: 'S03', h: '10:15', fin: '', statut: 'à venir', tache: 'Relevés + correction chlore', rec: 'Lun · jeu' },
    { id: 'J4', site: 'S04', h: '11:30', fin: '', statut: 'à venir', tache: 'Inspection des jets', rec: 'Tous les jeudis' },
    { id: 'J5', site: 'S05', h: '13:15', fin: '', statut: 'à venir', tache: 'Pré-hivernage', rec: null },
    { id: 'J6', site: 'S06', h: '14:45', fin: '', statut: 'à venir', tache: 'Vidange et relevés', rec: 'Quotidien' }
  ];

  const PLANNING_PERSO = [
    { jour: 'Ven 2 oct.', items: [['07:30', 'S07', 'Remplacement Maxime — relevés', null], ['10:00', 'S14', 'Fermeture de piscine', null], ['13:00', 'S15', 'Pré-hivernage', null]] },
    { jour: 'Lun 5 oct.', items: [['07:15', 'S01', 'Relevés RQEP', 'Lun · mer · jeu'], ['10:00', 'S03', 'Relevés spa', 'Lun · jeu'], ['13:30', 'S22', 'Hivernage', null]] },
    { jour: 'Mar 6 oct.', items: [['08:00', 'S05', 'Hivernage complet', null], ['12:30', 'S13', 'Fermeture jeux d\u2019eau', null]] },
    { jour: 'Mer 7 oct.', items: [['07:15', 'S01', 'Relevés RQEP', 'Lun · mer · jeu'], ['11:00', 'S06', 'Hivernage', null]] },
    { jour: 'Jeu 8 oct.', items: [['07:10', 'S02', 'Entretien hebdomadaire', 'Tous les jeudis'], ['08:20', 'S01', 'Relevés RQEP', 'Lun · mer · jeu'], ['10:15', 'S03', 'Relevés spa', 'Lun · jeu'], ['11:30', 'S04', 'Inspection des jets', 'Tous les jeudis']] }
  ];

  const INVENTAIRE_CAMION = [
    { id: 'P1', nom: 'Hypochlorite de sodium 12 %', unite: 'L', stock: 80, lot: 'Bidons 20 L' },
    { id: 'P2', nom: 'Bicarbonate de sodium', unite: 'kg', stock: 45, lot: 'Sacs 22,7 kg' },
    { id: 'P3', nom: 'Acide muriatique 31,45 %', unite: 'L', stock: 16, lot: 'Bidons 3,78 L' },
    { id: 'P4', nom: 'Chlorure de calcium', unite: 'kg', stock: 20, lot: 'Sacs 20 kg' },
    { id: 'P5', nom: 'Galets de trichlore', unite: 'u', stock: 60, lot: 'Chaudière 150' },
    { id: 'P6', nom: 'Antigel non toxique (hivernage)', unite: 'L', stock: 36, lot: 'Bidons 3,78 L' },
    { id: 'P7', nom: 'Bouchons d\u2019hivernage 1½ po', unite: 'u', stock: 24, lot: 'Vrac' },
    { id: 'P8', nom: 'Trousses DPD (réactifs)', unite: 'u', stock: 9, lot: 'Boîtes' }
  ];

  const DEMANDES = [
    { id: 'DM-311', type: 'Matériel', texte: '2 bidons d\u2019hypochlorite pour vendredi', statut: 'Livré', quand: 'Hier 15:40' },
    { id: 'DM-306', type: 'Renfort', texte: 'Aide pour levée de couverture — parc Quintal', statut: 'Accepté', quand: 'Mar 29 sept.' },
    { id: 'DM-298', type: 'Matériel', texte: 'Joint torique préfiltre Hayward SP2607', statut: 'Commandé', quand: 'Lun 28 sept.' }
  ];

  // Hivernage — 33 sites de la saison
  const HIV_NOMS = [
    ['Piscine du parc Quintal', 'Sherbrooke'], ['Pataugeoire du parc Victoria', 'Sherbrooke'], ['Jeux d\u2019eau du parc Jacques-Cartier', 'Sherbrooke'], ['Pataugeoire du parc Lucien-Blanchard', 'Sherbrooke'],
    ['Piscine du parc Belvédère', 'Sherbrooke'], ['Piscine du parc Lalemant', 'Sherbrooke'], ['Jeux d\u2019eau du parc Andrews', 'Sherbrooke'], ['Pataugeoire du parc Desranleau', 'Sherbrooke'],
    ['Jeux d\u2019eau du parc des Braves', 'Magog'], ['Condos Les Berges du lac', 'Magog'], ['Résidence Lapointe', 'Magog'], ['Piscine de la Pointe-Merry', 'Magog'],
    ['Résidence Bergeron', 'North Hatley'], ['Piscine municipale de Coaticook', 'Coaticook'], ['Jeux d\u2019eau du parc Laurence', 'Coaticook'],
    ['Pataugeoire du parc Laurier', 'Granby'], ['Piscine Miner', 'Granby'], ['Jeux d\u2019eau du parc Daniel-Johnson', 'Granby'], ['Piscine du parc Pelletier', 'Granby'],
    ['Résidence Tanguay', 'Bromont'], ['Piscine du parc Grégoire', 'Bromont'], ['Jeux d\u2019eau du parc Woodyatt', 'Drummondville'], ['Piscine Frigon', 'Drummondville'],
    ['Piscine Saint-Joseph', 'Drummondville'], ['Pataugeoire du parc Messier', 'Drummondville'], ['Piscine Cartier', 'Victoriaville'], ['Jeux d\u2019eau du parc Terre-des-Jeunes', 'Victoriaville'],
    ['Piscine du parc Sainte-Victoire', 'Victoriaville'], ['Piscine municipale de Windsor', 'Windsor'], ['Jeux d\u2019eau du parc Watopeka', 'Windsor'], ['Piscine de Cowansville', 'Cowansville'],
    ['Pataugeoire du parc Davignon', 'Cowansville'], ['Piscine municipale de Lac-Mégantic', 'Lac-Mégantic']
  ];
  const HIVERNAGE = HIV_NOMS.map((n, i) => ({
    id: 'H' + String(i + 1).padStart(2, '0'), nom: n[0], ville: n[1],
    statut: [0, 3, 5, 6, 7, 12, 15, 16, 21, 25, 28].includes(i) ? 'fait' : ([1, 2, 8, 9, 10].includes(i) ? 'cette semaine' : 'à planifier'),
    date: [0, 3, 5, 6, 7, 12, 15, 16, 21, 25, 28].includes(i) ? ['22 sept.', '23 sept.', '24 sept.', '25 sept.', '28 sept.', '29 sept.', '30 sept.'][i % 7] : ''
  }));
  HIVERNAGE[0].statut = 'aujourd\u2019hui'; HIVERNAGE[0].date = '1er oct.';
  const HIV_CHECKS = ['Niveau d\u2019eau abaissé sous les retours', 'Conduites purgées à l\u2019air comprimé', 'Bouchons d\u2019hivernage installés', 'Antigel versé dans les conduites', 'Pompe et filtre vidangés', 'Équipements amovibles rentrés', 'Couverture d\u2019hiver installée et tendue'];

  // Monitoring — flux d'activité
  const FLUX = [
    { h: '09:42', tech: 'T3', txt: 'Relevé saisi — pH 7,4 · chlore libre 1,6', site: 'S01', k: 'releve' },
    { h: '09:38', tech: 'T2', txt: 'Alerte salle mécanique — pompe doseuse chlore', site: 'S08', k: 'alerte' },
    { h: '09:31', tech: 'T6', txt: 'Pause', site: 'S11', k: 'punch' },
    { h: '09:24', tech: 'T5', txt: 'Chlore combiné 0,4 — dans la zone', site: 'S09', k: 'releve' },
    { h: '09:11', tech: 'T4', txt: 'Dépunch — en route vers Drummondville', site: 'S18', k: 'punch' },
    { h: '09:02', tech: 'T7', txt: 'Photo ajoutée — salle mécanique', site: 'S12', k: 'photo' },
    { h: '08:55', tech: 'T1', txt: 'Demande de matériel — 3 trousses DPD', site: 'S07', k: 'demande' },
    { h: '08:24', tech: 'T3', txt: 'Punch', site: 'S01', k: 'punch' },
    { h: '08:15', tech: 'T7', txt: 'Punch', site: 'S12', k: 'punch' },
    { h: '07:55', tech: 'T3', txt: 'Fiche validée — entretien hebdomadaire', site: 'S02', k: 'releve' }
  ];

  // Opérations — dossiers clients (visites regroupées par contrat)
  const V = (date, tache, tech, statut) => ({ date, tache, tech, statut });
  const DOSSIERS = [
    { id: 'D-26-041', client: 'Ville de Magog', contrat: 'C-26-014', objet: 'Entretien saisonnier 2026 — 2 sites', statut: 'En cours', resp: 'T3', sites: ['S01', 'S04'], visites: [V('1er oct.', 'Relevés RQEP', 'T3', 'en cours'), V('1er oct.', 'Inspection des jets', 'T3', 'planifié'), V('30 sept.', 'Relevés RQEP', 'T3', 'fait'), V('28 sept.', 'Relevés RQEP', 'T3', 'fait'), V('24 sept.', 'Inspection des jets', 'T3', 'fait')], total: 118, faits: 104 },
    { id: 'D-26-052', client: 'Ville de Sherbrooke', contrat: 'C-26-009', objet: 'Hivernage 2026 — 8 installations extérieures', statut: 'En cours', resp: 'T1', sites: ['S05', 'S06', 'S13', 'S22'], visites: [V('1er oct.', 'Pré-hivernage parc Quintal', 'T3', 'planifié'), V('30 sept.', 'Hivernage parc Belvédère', 'T1', 'fait'), V('29 sept.', 'Hivernage parc Lalemant', 'T1', 'fait'), V('6 oct.', 'Hivernage complet parc Quintal', 'T3', 'planifié')], total: 8, faits: 3 },
    { id: 'D-26-058', client: 'Hôtel Le Montagnard', contrat: 'C-26-031', objet: 'Entretien spa — contrat annuel', statut: 'En cours', resp: 'T3', sites: ['S03'], visites: [V('1er oct.', 'Relevés + correction chlore', 'T3', 'planifié'), V('28 sept.', 'Relevés spa', 'T3', 'fait'), V('24 sept.', 'Vidange complète', 'T3', 'fait')], total: 104, faits: 79 },
    { id: 'D-26-060', client: 'Ville de Granby', contrat: 'C-26-022', objet: 'Réparation pompe doseuse — complexe aquatique', statut: 'Urgent', resp: 'T2', sites: ['S08'], visites: [V('1er oct.', 'Diagnostic pompe doseuse', 'T2', 'en cours'), V('2 oct.', 'Remplacement tête de pompe', null, 'à assigner')], total: 2, faits: 0 },
    { id: 'D-26-063', client: 'Mme Nathalie Bergeron', contrat: 'R-26-208', objet: 'Entretien hebdo + fermeture', statut: 'En cours', resp: 'T3', sites: ['S02'], visites: [V('1er oct.', 'Entretien hebdomadaire', 'T3', 'fait'), V('8 oct.', 'Fermeture de piscine', 'T3', 'planifié')], total: 20, faits: 18 },
    { id: 'D-26-066', client: 'Ville de Drummondville', contrat: 'C-26-027', objet: 'Remplacement du média filtrant — 3 filtres', statut: 'Soumission', resp: 'T4', sites: ['S10'], visites: [V('13 oct.', 'Vidange des filtres', null, 'à assigner'), V('14 oct.', 'Remplissage média + mise en service', null, 'à assigner')], total: 2, faits: 0 },
    { id: 'D-26-070', client: 'Cégep de Sherbrooke', contrat: 'C-26-040', objet: 'Contrat annuel — piscine', statut: 'En cours', resp: 'T5', sites: ['S09'], visites: [V('1er oct.', 'Relevés', 'T5', 'en cours'), V('30 sept.', 'Relevés', 'T5', 'fait')], total: 150, faits: 96 },
    { id: 'D-26-034', client: 'Syndicat Les Berges', contrat: 'C-26-051', objet: 'Saison 2026 + hivernage', statut: 'À facturer', resp: 'T1', sites: ['S15'], visites: [V('29 sept.', 'Hivernage', 'T1', 'fait'), V('25 sept.', 'Dernier entretien', 'T1', 'fait')], total: 36, faits: 36 }
  ];

  // Planning équipe — semaine du 28 sept.
  const JOURS = ['Lun 28', 'Mar 29', 'Mer 30', 'Jeu 1er', 'Ven 2'];
  const CRENEAUX = [
    ['T1', 0, '07:30', 'S07', 'Relevés', true], ['T1', 1, '07:30', 'S14', 'Entretien', true], ['T1', 2, '07:30', 'S07', 'Relevés', true], ['T1', 3, '08:00', 'S07', 'Relevés', true], ['T1', 4, '09:00', 'S15', 'Hivernage', false],
    ['T2', 0, '07:30', 'S08', 'Relevés', true], ['T2', 1, '07:30', 'S08', 'Relevés', true], ['T2', 2, '07:30', 'S17', 'Hivernage', false], ['T2', 3, '07:45', 'S08', 'Diagnostic', false], ['T2', 4, '07:30', 'S08', 'Relevés', true],
    ['T3', 0, '07:15', 'S01', 'Relevés RQEP', true], ['T3', 1, '08:00', 'S05', 'Relevés', true], ['T3', 2, '07:15', 'S01', 'Relevés RQEP', true], ['T3', 3, '07:10', 'S02', 'Tournée · 6 arrêts', true], ['T3', 4, '07:30', 'S07', 'Remplacement', false],
    ['T4', 0, '08:00', 'S10', 'Relevés', false], ['T4', 1, '08:00', 'S10', 'Relevés', true], ['T4', 3, '08:00', 'S18', 'Hivernage', false], ['T4', 4, '08:00', 'S10', 'Soumission', false],
    ['T5', 0, '08:30', 'S09', 'Relevés', true], ['T5', 1, '09:00', 'S16', 'Relevés', true], ['T5', 2, '08:30', 'S09', 'Relevés', true], ['T5', 3, '08:30', 'S09', 'Relevés', false], ['T5', 4, '08:30', 'S20', 'Spa', true],
    ['T6', 0, '08:00', 'S21', 'Relevés', true], ['T6', 1, '08:00', 'S11', 'Relevés', true], ['T6', 3, '08:00', 'S11', 'Hivernage', false],
    ['T7', 0, '08:15', 'S12', 'Spa', true], ['T7', 2, '08:15', 'S19', 'Entretien', true], ['T7', 3, '08:15', 'S12', 'Spa', false], ['T7', 4, '08:15', 'S12', 'Spa', true]
  ];

  // Sites détectés automatiquement / doublons
  const SITES_NOUVEAUX = [
    { id: 'N1', nom: '1245 ch. de la Rivière, Magog', source: 'Punch GPS · Jérémie Roy · 30 sept.', lat: 45.2502, lng: -72.1105, suggestion: 'Nouvelle résidence — aucun contrat' },
    { id: 'N2', nom: 'Piscine parc Quintal (entrée nord)', source: 'Punch GPS · Maxime Tremblay · 29 sept.', lat: 45.4139, lng: -71.8744, suggestion: 'Probable doublon de « Piscine du parc Quintal » (160 m)', doublon: 'S05' },
    { id: 'N3', nom: 'Spa Bromont — bâtiment B', source: 'Bon de livraison · Samuel Lavoie · 28 sept.', lat: 45.3175, lng: -72.6492, suggestion: 'Probable doublon de « Spa nordique Bromont » (60 m)', doublon: 'S12' }
  ];

  // Facturation (remplace le fichier Excel)
  const B = (odt, po, client, site, date, calc, fact, statut) => ({ odt, po, client, site, date, calc, fact, statut });
  const FACTURES = [
    B('ODT-26-1184', '4500-22871', 'Ville de Magog', 'S01', '30 sept.', 1840.00, 1840.00, 'À facturer'),
    B('ODT-26-1183', '4500-22871', 'Ville de Magog', 'S04', '24 sept.', 420.00, 460.00, 'À facturer'),
    B('ODT-26-1179', 'BC-2026-0412', 'Ville de Sherbrooke', 'S05', '29 sept.', 2315.50, 2315.50, 'Facturé'),
    B('ODT-26-1176', '', 'Hôtel Le Montagnard', 'S03', '24 sept.', 685.00, 640.00, 'À facturer'),
    B('ODT-26-1172', 'PO-88213', 'Ville de Granby', 'S08', '26 sept.', 3120.00, 3120.00, 'Facturé'),
    B('ODT-26-1168', 'BC-2026-0398', 'Ville de Sherbrooke', 'S07', '25 sept.', 2980.00, 2980.00, 'Payé'),
    B('ODT-26-1165', '', 'Mme Nathalie Bergeron', 'S02', '24 sept.', 165.00, 165.00, 'Payé'),
    B('ODT-26-1161', 'C-26-040/09', 'Cégep de Sherbrooke', 'S09', '23 sept.', 1460.00, 1525.00, 'Facturé'),
    B('ODT-26-1158', '', 'Syndicat Les Berges', 'S15', '22 sept.', 910.00, 910.00, 'À facturer'),
    B('ODT-26-1154', 'PO-2026-117', 'Ville de Drummondville', 'S10', '22 sept.', 2240.00, 2100.00, 'Payé'),
    B('ODT-26-1150', 'BV-5541', 'Bromont Villégiature', 'S12', '21 sept.', 1275.00, 1275.00, 'Facturé'),
    B('ODT-26-1147', '', 'M. Éric Lapointe', 'S14', '19 sept.', 145.00, 145.00, 'Payé')
  ];

  // Sondages
  const SONDAGES = [
    { id: 'SO-07', titre: 'Satisfaction fin de saison 2026', cible: 'Clients municipaux et commerciaux', envoyes: 42, reponses: 27, score: 4.4, statut: 'En cours', ferme: '15 oct.',
      questions: [
        { q: 'Qualité de l\u2019eau durant la saison', dist: [0, 1, 2, 9, 15] },
        { q: 'Ponctualité des visites', dist: [0, 2, 4, 10, 11] },
        { q: 'Clarté des rapports reçus', dist: [1, 2, 6, 11, 7] },
        { q: 'Réactivité lors d\u2019une urgence', dist: [0, 0, 3, 8, 16] }
      ],
      verbatims: ['Techniciens toujours disponibles, même le dimanche.', 'Aimerions recevoir les relevés chaque semaine par courriel.', 'Délai de 3 jours pour la pièce de pompe en juillet.'] },
    { id: 'SO-06', titre: 'Service résidentiel — été 2026', cible: 'Clients résidentiels', envoyes: 64, reponses: 41, score: 4.6, statut: 'Fermé', ferme: '15 sept.', questions: [], verbatims: [] },
    { id: 'SO-05', titre: 'Suivi d\u2019intervention urgente', cible: 'Envoi automatique après urgence', envoyes: 9, reponses: 7, score: 4.1, statut: 'Automatique', ferme: '—', questions: [], verbatims: [] }
  ];

  // Communication — statistiques du département (semaine 40)
  const STATS_SEMAINE = { semaine: 'Semaine 40 · 28 sept. – 2 oct.', visites: 186, releves: 742, horsZone: 23, corriges: 21, heures: 312.5, hivernages: 11, urgences: 2 };

  // Temps / Suivi / Cumul — valeurs issues du calcul existant (affichage seulement)
  const TEMPS = TECHS.map((t, i) => {
    const jours = [[8.25, 8.5, 8.0, 8.75, 7.5], [8.0, 8.25, 8.5, 8.0, 8.0], [8.5, 9.0, 8.25, 9.25, 0], [8.0, 7.75, 8.0, 8.5, 0], [8.25, 8.0, 8.5, 8.0, 0], [7.5, 8.0, 0, 8.0, 0], [8.0, 8.5, 9.75, 8.25, 0], [0, 0, 0, 0, 0]][i];
    return { tech: t.id, jours, semaine: jours.reduce((a, b) => a + b, 0), cumul: [612.5, 598.0, 655.25, 540.0, 587.75, 501.5, 619.0, 322.0][i], banque: [6.5, 2.0, 14.25, 0, 4.75, 0, 9.5, 0][i], sup: [0, 0, 1.75, 0, 0, 0, 0.75, 0][i] };
  });
  const PUNCHS = [
    { tech: 'T3', jour: 'Jeu 1er oct.', entree: '07:04', sortie: '—', site: 'S02 → S01', etat: 'En cours', flag: null },
    { tech: 'T7', jour: 'Mer 30 sept.', entree: '08:12', sortie: '17:58', site: 'S19', etat: 'À valider', flag: 'Dépunch automatique à 17:58 — oubli probable' },
    { tech: 'T6', jour: 'Mar 29 sept.', entree: '07:51', sortie: '16:02', site: 'S11', etat: 'À valider', flag: 'Punch à 1,2 km du site (hors géorepérage)' },
    { tech: 'T4', jour: 'Mar 29 sept.', entree: '07:58', sortie: '16:06', site: 'S10', etat: 'À valider', flag: 'Pause non enregistrée' },
    { tech: 'T1', jour: 'Mer 30 sept.', entree: '07:28', sortie: '16:01', site: 'S07', etat: 'Validé', flag: null },
    { tech: 'T2', jour: 'Mer 30 sept.', entree: '07:26', sortie: '16:11', site: 'S17', etat: 'Validé', flag: null },
    { tech: 'T5', jour: 'Mer 30 sept.', entree: '08:27', sortie: '17:02', site: 'S09', etat: 'Validé', flag: null }
  ];

  const byId = (arr, id) => arr.find(x => x.id === id);
  window.SA_DATA = { TYPES, TECHS, SITES, SALLES, HIST, TOURNEE, PLANNING_PERSO, INVENTAIRE_CAMION, DEMANDES, HIVERNAGE, HIV_CHECKS, FLUX, DOSSIERS, JOURS, CRENEAUX, SITES_NOUVEAUX, FACTURES, SONDAGES, STATS_SEMAINE, TEMPS, PUNCHS,
    site: id => byId(SITES, id), tech: id => byId(TECHS, id), aujourdhui: 'Jeudi 1er octobre 2026' };
  window.dispatchEvent(new Event('sa-data'));
})();
