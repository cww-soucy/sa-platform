/* Affichage configurable des apps (sa-admin, sa-terrain, portail client) — demande de la direction, 2026-11-03.
   Le bureau choisit, dans sa-admin › Affichage des apps, ce que chaque profil voit : modules du menu, onglets, sections.
   Règles en base : table affichage_regles (une ligne par app et par profil), docs/sql/MIGRATION_2026-11-03_affichage_modules.sql.

   Principe : TOUT EST VISIBLE PAR DÉFAUT. Une règle ne fait que masquer (true) ou réafficher (false) un élément.
   Ordre de priorité, du plus général au plus précis (le plus précis l'emporte) :
     sa-admin / sa-terrain : tous  →  role:<rôle>  →  compte:<identifiant>
     portail client        : tous  →  niveau:<niveau d'accès>  →  client:<compte client>
   Un élément dont le « parent » est masqué l'est aussi (ex. les onglets de Planning quand Planning est masqué).
   C'est de l'affichage, pas de la sécurité : les droits réels restent ceux de la base (RLS).

   Aucune dépendance : intégré tel quel dans admin.html / terrain.html (build) et chargé par portail/ ;
   testé par tests/affichage.test.js. Expose window.SAAff (navigateur) ou module.exports (Node). */
(function (root) {
  'use strict';
  /* [clé, libellé, options] — options : parent (clé), verrou (true = jamais masqué ; 'admin' = jamais pour le rôle admin), sec (sous-titre) */
  var G = function (id, nom, aide, items) { return { id: id, nom: nom, aide: aide, items: items.map(function (x) { return { cle: x[0], nom: x[1], parent: (x[2] || {}).parent || null, verrou: (x[2] || {}).verrou || null, sec: (x[2] || {}).sec || '' }; }) }; };
  var P = function (p, o) { return Object.assign({ parent: p }, o || {}); };
  var CATALOGUE = {
    admin: { nom: 'sa-admin', sous: 'Centre des opérations (bureau)', groupes: [
      G('menu', 'Menu de gauche', 'Les modules du menu. Un module masqué disparaît du menu et ne s’ouvre plus.', [
        ['menu.monitoring', 'Monitoring', { sec: 'Terrain' }], ['menu.carte', 'Carte des sites', { sec: 'Terrain' }], ['menu.sites', 'Sites et inspections', { sec: 'Terrain' }],
        ['menu.globale', 'Vue globale', { sec: 'Gestion' }], ['menu.planmatch', 'Plan de Match', { sec: 'Gestion' }], ['menu.operations', 'Opérations', { sec: 'Gestion' }],
        ['menu.planning', 'Planning équipe', { sec: 'Gestion' }], ['menu.facturation', 'Facturation', { sec: 'Gestion' }],
        ['menu.logistique', 'Logistique', { sec: 'Matériel' }], ['menu.stock', 'Stock', { sec: 'Matériel' }], ['menu.flotte', 'Flotte', { sec: 'Matériel' }], ['menu.outils', 'Outils · QR', { sec: 'Matériel' }],
        ['menu.sondages', 'Sondages clients', { sec: 'Équipe' }], ['menu.communication', 'Communication', { sec: 'Équipe' }], ['menu.temps', 'Temps · Paie', { sec: 'Équipe' }],
        ['menu.stats', 'Stats', { sec: 'Équipe' }], ['menu.comptes', 'Comptes', { sec: 'Équipe' }],
        ['menu.affichage', 'Affichage des apps', { sec: 'Équipe', verrou: 'admin' }]]),
      G('accueil', 'Page d’accueil', 'Les tuiles de la page qui s’ouvre après la connexion. La tuile sa-admin reste toujours.', [
        ['accueil.platform', 'Tuile SA Platform'], ['accueil.temps', 'Tuile Temps · Paie', P('menu.temps')], ['accueil.terrain', 'Tuile sa-terrain']]),
      G('sites', 'Sites et inspections · onglets', 'La barre d’onglets en haut de Sites et inspections.', [
        ['sites.insp', 'Inspections et rapports', P('menu.sites')], ['sites.hiv', 'Hivernage', P('menu.sites')], ['sites.clients', 'Clients et sites', P('menu.sites')],
        ['sites.lieux', 'Lieux à classer', P('menu.sites')], ['sites.rep', 'Répertoire', P('menu.sites')]]),
      G('fiche', 'Fiche d’un site · onglets', 'Les onglets d’un site dans Inspections et rapports.', [
        ['fiche.bilan', 'Bilan par système', P('sites.insp')], ['fiche.visite', 'Visites', P('sites.insp')], ['fiche.perso', 'Inspections personnalisées', P('sites.insp')],
        ['fiche.tendances', 'Tendances de l’eau', P('sites.insp')], ['fiche.saisie', 'Nouvelle inspection', P('sites.insp')], ['fiche.bassins', 'Bassins et plan', P('sites.insp')],
        ['fiche.hiver', 'Hivernement', P('sites.insp')], ['fiche.acces', 'Accès client', P('sites.insp')], ['fiche.points', 'Points de contrôle', P('sites.insp')]]),
      G('monitoring', 'Monitoring · sections', 'Les blocs de l’écran Monitoring.', [
        ['mon.mur', 'Bouton « Mur de contrôle »', P('menu.monitoring')], ['mon.livraisons', 'Livraisons en cours', P('menu.monitoring')], ['mon.equipe', 'Équipe en ce moment', P('menu.monitoring')],
        ['mon.flux', 'Flux terrain', P('menu.monitoring')], ['mon.salles', 'Salles mécaniques', P('menu.monitoring')], ['mon.horszone', 'Relevés hors zone', P('menu.monitoring')]]),
      G('globale', 'Vue globale · sections', 'Les blocs de l’écran Vue globale.', [
        ['glob.livraisons', 'Livraisons en cours', P('menu.globale')], ['glob.kpis', 'Chiffres clés', P('menu.globale')], ['glob.charge', 'Charge par technicien', P('menu.globale')],
        ['glob.alertes', 'Alertes', P('menu.globale')], ['glob.prochains', 'Les 7 prochains jours', P('menu.globale')], ['glob.valider', 'Terminé par l’équipe — à valider', P('menu.globale')]]),
      G('planning', 'Planning équipe · vues', 'Les vues proposées en haut de Planning équipe.', [
        ['planning.semaine', 'Semaine', P('menu.planning')], ['planning.mois', '4 semaines', P('menu.planning')], ['planning.gantt', 'Diagramme des travaux', P('menu.planning')], ['planning.series', 'Séries récurrentes', P('menu.planning')]]),
      G('temps', 'Temps · Paie · onglets', 'Les onglets de Temps · Paie.', [
        ['temps.semaine', 'Semaine', P('menu.temps')], ['temps.employe', 'Par employé', P('menu.temps')], ['temps.valider', 'À valider', P('menu.temps')], ['temps.paie', 'Paie', P('menu.temps')], ['temps.cumul', 'Cumul', P('menu.temps')]]),
      G('logistique', 'Logistique · onglets', 'Les onglets de Logistique.', [
        ['log.bl', 'Bons de livraison', P('menu.logistique')], ['log.so', 'Sorties d’inventaire', P('menu.logistique')], ['log.ent', 'Entrepôt · courriels', P('menu.logistique')]]),
      G('outils', 'Outils · QR · onglets', 'Les onglets de Outils · QR.', [
        ['outils.outils', 'Outils', P('menu.outils')], ['outils.emp', 'Emplacements', P('menu.outils')], ['outils.cfg', 'Configuration', P('menu.outils')]])] },
    terrain: { nom: 'sa-terrain', sous: 'App du technicien (téléphone)', groupes: [
      G('onglets', 'Barre du bas', 'Les onglets en bas de l’écran. « Aujourd’hui » et « Profil » restent toujours (accueil, déconnexion).', [
        ['onglet.today', 'Aujourd’hui', { verrou: true }], ['onglet.temps', 'Temps (punch)'], ['onglet.fiche', 'Fiche (l’onglet ; la fiche s’ouvre toujours depuis la tournée)'], ['onglet.planning', 'Planning'], ['onglet.demandes', 'Demandes'], ['onglet.profil', 'Profil', { verrou: true }]]),
      G('accueil', 'Écran « Aujourd’hui »', 'Ce qui s’affiche sur l’écran d’accueil du technicien.', [
        ['accueil.tournee', 'Tournée du jour'], ['accueil.comm', 'Communications (bandeau et bouton)'],
        ['accueil.logistique', 'Tuile Logistique'], ['accueil.hivernage', 'Tuile Hivernage'], ['accueil.demande', 'Tuile Demande', P('onglet.demandes')], ['accueil.bureau', 'Tuile Appeler le bureau']]),
      G('ecrans', 'Autres écrans · sections', 'Sections des autres onglets.', [
        ['temps.semaine', 'Temps : détail de la semaine', P('onglet.temps')], ['planning.recurrentes', 'Planning : mes visites récurrentes', P('onglet.planning')], ['demandes.historique', 'Demandes : mes demandes', P('onglet.demandes')]])] },
    portail: { nom: 'Portail client', sous: 'Ce que voient les clients (QR et « Envoyer au client »)', groupes: [
      G('onglets', 'Onglets', 'Les onglets sous l’état des systèmes. Les droits par niveau d’accès s’appliquent toujours en plus.', [
        ['onglet.releves', 'Relevés'], ['onglet.historique', 'Historique'], ['onglet.rapports', 'Rapports'], ['onglet.documents', 'Plans et documents'], ['onglet.interventions', 'Interventions'], ['onglet.factures', 'Factures']]),
      G('sections', 'Sections', 'Les blocs de la page d’une installation.', [
        ['sec.bandeau', 'Bandeau « Tout est conforme » / interventions'], ['sec.systemes', 'État des systèmes'], ['sec.attention', 'À votre attention'],
        ['sec.plan', 'Plan de l’installation'], ['sec.bassins', 'Vos bassins'], ['sec.rapport', 'Bouton « Rapport de la dernière visite »'], ['sec.urgence', 'Numéro d’urgence 24/7']])] }
  };
  var ITEMS = {};
  Object.keys(CATALOGUE).forEach(function (app) { var o = ITEMS[app] = {}; CATALOGUE[app].groupes.forEach(function (g) { g.items.forEach(function (it) { it.groupe = g.id; o[it.cle] = it; }); }); });

  var ROLES = [['employe', 'Employés (techniciens)'], ['superviseur', 'Superviseurs'], ['admin', 'Administrateurs']];
  var NIVEAUX = [['operateur', 'Opérateurs'], ['gestionnaire', 'Gestionnaires'], ['direction', 'Direction'], ['saisie', 'Saisie des tests']];

  /* Profils applicables, du plus général au plus précis. qui = {role, compte} (apps internes) ou {niveau, client} (portail). */
  function cibles(app, qui) {
    qui = qui || {};
    if (app === 'portail') return ['tous'].concat(qui.niveau ? ['niveau:' + qui.niveau] : [], qui.client ? ['client:' + qui.client] : []);
    var r = qui.role ? (qui.role === 'admin' || qui.role === 'superviseur' ? qui.role : 'employe') : ''; /* tout autre rôle (ex. technicien) = employé */
    return ['tous'].concat(r ? ['role:' + r] : [], qui.compte ? ['compte:' + String(qui.compte).toLowerCase()] : []);
  }
  function idRegle(app, cible) { return app + '|' + cible; }
  function index(regles, app) { var o = {}; (regles || []).forEach(function (r) { if (r && r.app === app && r.cible) o[r.cible] = r.masques || {}; }); return o; }
  function verrouille(it, qui) { return !!it && (it.verrou === true || (it.verrou && qui && it.verrou === qui.role)); }

  /* État calculé pour un profil : masque[cle] = true si masqué ; source[cle] = profil qui a décidé (ou '' = défaut). */
  function resoudre(regles, app, qui, sauf) {
    var idx = index(regles, app), brut = {}, src = {}, items = ITEMS[app] || {};
    cibles(app, qui).forEach(function (c) { if (c === sauf) return; var m = idx[c]; if (!m) return; Object.keys(m).forEach(function (k) { if (typeof m[k] === 'boolean') { brut[k] = m[k]; src[k] = c; } }); });
    var masque = {};
    var cache = function (k, n) { if (n > 8) return false; var it = items[k]; if (verrouille(it, qui)) return false; if (brut[k] === true) return true; return !!(it && it.parent && cache(it.parent, n + 1)); };
    Object.keys(items).forEach(function (k) { if (cache(k, 0)) masque[k] = true; });
    return { app: app, qui: qui || {}, masque: masque, brut: brut, source: src };
  }
  function visible(etat, cle) { return !(etat && etat.masque && etat.masque[cle]); }
  /* Règle CSS qui masque les éléments marqués data-aff="<clé>" (sections du gabarit) */
  function css(etat) {
    var k = Object.keys((etat && etat.masque) || {}).filter(function (x) { return /^[a-z0-9.-]+$/.test(x); });
    return k.length ? k.map(function (x) { return '[data-aff~="' + x + '"]'; }).join(',') + '{display:none!important}' : '';
  }
  function appliquer(doc, etat) {
    if (!doc || !doc.head) return; var el = doc.getElementById('sa-aff');
    if (!el) { el = doc.createElement('style'); el.id = 'sa-aff'; doc.head.appendChild(el); }
    var t = css(etat); if (el.textContent !== t) el.textContent = t;
  }
  /* Premier élément visible d'une liste de clés (pour rediriger un onglet ou un module masqué) */
  function premier(etat, cles, defaut) { for (var i = 0; i < cles.length; i++) if (visible(etat, cles[i])) return cles[i]; return defaut; }
  function nbMasques(etat) { return Object.keys((etat && etat.masque) || {}).length; }

  var api = { CATALOGUE: CATALOGUE, ITEMS: ITEMS, ROLES: ROLES, NIVEAUX: NIVEAUX, cibles: cibles, idRegle: idRegle, resoudre: resoudre, visible: visible, css: css, appliquer: appliquer, premier: premier, nbMasques: nbMasques, verrouille: verrouille };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SAAff = api;
})(typeof window !== 'undefined' ? window : this);
