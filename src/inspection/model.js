/* Règles communes des inspections (sa-terrain, sa-admin, portail client) — passation §8.
   Aucune dépendance : intégré tel quel dans admin.html / terrain.html (build) et chargé par portail/ ;
   testé par tests/inspection-model.test.js. Expose window.SAInsp (navigateur) ou module.exports (Node). */
(function (root) {
  'use strict';
  var SYSTEMES = [
    { code: 'eau', nom: 'Eau du bassin', icone: 'droplet' },
    { code: 'dosage', nom: 'Traitement et dosage', icone: 'flask' },
    { code: 'circulation', nom: 'Circulation et filtration', icone: 'cycle' },
    { code: 'chauffage', nom: 'Chauffage et ventilation', icone: 'thermo' },
    { code: 'securite', nom: 'Sécurité et RQEP', icone: 'alert' },
    { code: 'structure', nom: 'Structure et surfaces', icone: 'building' }
  ];
  var NOM = {}; SYSTEMES.forEach(function (s) { NOM[s.code] = s.nom; });
  var RANG = { action: 3, watch: 2, ok: 1, na: 0 };
  var LIB = { ok: 'Conforme', watch: 'À surveiller', action: 'Action requise', na: 'Sans objet' };
  var LIB_CLIENT = { ok: 'Conforme', watch: 'À surveiller', action: 'Intervention', na: 'Sans objet' };
  /* Droits par niveau d'accès (grille 5a-2) ; un compte client peut les surcharger (client_comptes.niveaux) */
  var DROITS = ['etat', 'releves', 'rqep', 'plans', 'historique', 'rapports', 'interventions', 'exports', 'factures'];
  var NIVEAUX = {
    operateur: { etat: true, releves: true, rqep: true, plans: true, historique: false, rapports: false, interventions: false, exports: false, factures: false },
    gestionnaire: { etat: true, releves: true, rqep: true, plans: true, historique: true, rapports: true, interventions: true, exports: true, factures: false },
    direction: { etat: true, releves: true, rqep: true, plans: true, historique: true, rapports: true, interventions: true, exports: true, factures: true }
  };
  var NIVEAU_NOM = { operateur: 'Opérateur', gestionnaire: 'Gestionnaire', direction: 'Direction' };
  var VIS_RANG = { operateur: 1, gestionnaire: 2, direction: 3, interne: 9 };

  /* Répartition d'un point existant (libellé de types_bassin.checks) dans un système — même règle que la migration SQL */
  var RX_SECU = /(registre|clôture|portail|échelle|main courante|premiers soins|drain|grille|profondeur|arrêt d.urgence|saillante)/i;
  function systemeDe(lib) {
    lib = String(lib || '');
    if (RX_SECU.test(lib)) return 'securite';
    if (/(écumoire|filtre|préfiltre|pompe|bouton|détecteur|jets)/i.test(lib)) return 'circulation';
    if (/(dos|chlorat|réservoir|injection)/i.test(lib)) return 'dosage';
    if (/(chauff|ventil|échangeur|thermo)/i.test(lib)) return 'chauffage';
    return 'structure';
  }
  /* Points actifs d'un type de bassin : catalogue (inspection_points) si renseigné, sinon les vérifications du type */
  function pointsDuType(code, catalogue, checks) {
    var c = (catalogue || []).filter(function (p) { return p.actif !== false && (!p.type_code || p.type_code === code); });
    if (!c.length && !(catalogue || []).some(function (p) { return p.type_code === code; })) {
      c = (checks || []).map(function (lib, i) {
        var s = systemeDe(lib);
        return { id: code + '-' + i, systeme_code: s, type_code: code, libelle: lib, mode: s === 'securite' ? 'ouinon' : 'etat', obligatoire: s === 'securite', ordre: i + 1 };
      });
    }
    return c.slice().sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
  }

  /* État d'un paramètre d'eau : hors [lo, hi] → action ; dans les 10 % de la largeur de zone près d'un bord → watch */
  var MARGE = 0.1;
  function etatEau(f, v) {
    if (v == null || v === '' || isNaN(+v)) return 'na';
    v = +v;
    var lo = +f.lo, hi = +f.hi, eps = 1e-9;
    if (v < lo - eps || v > hi + eps) return 'action';
    var m = (hi - lo) * MARGE;
    if (m > 0 && (v < lo + m - eps || v > hi - m + eps)) return 'watch';
    return 'ok';
  }
  function pire(etats) {
    var r = 'na';
    (etats || []).forEach(function (e) { if ((RANG[e] || 0) > RANG[r]) r = e; });
    return r;
  }
  function nombre(v, step) {
    var d = String(step || 1).indexOf('.') >= 0 ? String(step).split('.')[1].length : 0;
    return (+v).toFixed(Math.min(d, 2)).replace('.', ',');
  }

  /* Tous les points d'une visite (une ligne de releves) : eau (vals/touched) + points (ou anciennes vérifications) */
  function itemsVisite(r, type, catalogue) {
    type = type || {}; r = r || {};
    var out = [], touched = r.touched || null, acts = r.actions || {};
    (type.fields || []).forEach(function (f) {
      var v = r.vals && r.vals[f.key];
      if (v == null || (touched && !touched[f.key])) return;
      var e = etatEau(f, v);
      var zone = nombre(f.lo, f.step) + ' – ' + nombre(f.hi, f.step);
      out.push({ id: 'eau:' + f.key, systeme: 'eau', libelle: f.label, etat: e, valeur: nombre(v, f.step) + (f.unit ? ' ' + f.unit : ''),
        detail: e === 'action' ? 'Hors zone · zone ' + zone : e === 'watch' ? 'Près de la limite · zone ' + zone : 'Zone ' + zone,
        note: acts[f.key] ? 'Mesure prise : ' + acts[f.key] : '' });
    });
    var pts = pointsDuType(r.type_code, catalogue, type.checks), P = r.points || null;
    pts.forEach(function (p) {
      var x = P ? P[p.id] : null;
      if (!x && !P && r.checks && r.checks[p.libelle] === true) x = { etat: 'ok' };
      if (!x || !x.etat) return;
      out.push({ id: p.id, systeme: p.systeme_code, libelle: p.libelle, etat: x.etat, valeur: x.valeur != null && x.valeur !== '' ? String(x.valeur) + (p.unite ? ' ' + p.unite : '') : '',
        detail: x.note || '', note: x.note || '', wo_id: x.wo_id || null, photos: x.photos || [], mode: p.mode });
    });
    return out;
  }
  function etatsSystemes(items) {
    var o = {};
    SYSTEMES.forEach(function (s) { o[s.code] = pire(items.filter(function (i) { return i.systeme === s.code; }).map(function (i) { return i.etat; })); });
    return o;
  }
  function compteurs(items) {
    var c = { action: 0, watch: 0, ok: 0, na: 0 };
    items.forEach(function (i) { c[i.etat] = (c[i.etat] || 0) + 1; });
    return c;
  }
  /* Score de gravité d'un site (tri des listes) : Σ action × 10 + Σ watch × 3 */
  function score(items) { var c = compteurs(items); return c.action * 10 + c.watch * 3; }
  /* 4 pastilles d'un site : eau / mécanique (dosage, circulation, chauffage) / sécurité / structure */
  function pastilles(se) {
    return { eau: se.eau, meca: pire([se.dosage, se.circulation, se.chauffage]), secu: se.securite, struct: se.structure };
  }
  function pl(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
  function verdict(items) {
    var c = compteurs(items);
    return pl(c.action, 'action requise', 'actions requises') + ', ' + pl(c.watch, 'point à surveiller', 'points à surveiller') + ', ' + pl(c.ok, 'point conforme', 'points conformes') + '.';
  }
  function liste(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1]; }
  /* Résumé automatique (interne ou client) */
  function resume(items, client) {
    var act = items.filter(function (i) { return i.etat === 'action'; }), wat = items.filter(function (i) { return i.etat === 'watch'; });
    var se = etatsSystemes(items), conf = SYSTEMES.filter(function (s) { return se[s.code] === 'ok'; }).map(function (s) { return s.nom.toLowerCase(); });
    var lab = function (i) { return i.libelle + (i.valeur && !client ? ' ' + i.valeur : ''); };
    var p = [];
    if (!items.length) return client ? 'Aucun constat pour cette visite.' : 'Aucun point saisi.';
    if (act.length) p.push(client ? 'Intervention en cours : ' + liste(act.map(function (i) { return i.libelle; })) + '.' : pl(act.length, 'action requise', 'actions requises') + ' : ' + act.map(lab).join(', ') + '.');
    if (wat.length) p.push('À surveiller : ' + wat.map(client ? function (i) { return i.libelle; } : lab).join(', ') + '.');
    if (conf.length) { var t = liste(conf); p.push(t.charAt(0).toUpperCase() + t.slice(1) + (conf.length > 1 ? ' sont conformes.' : ' est conforme.')); }
    if (!act.length && !wat.length) p.unshift(client ? 'Tout est conforme.' : 'Tout est conforme.');
    return p.join(' ');
  }
  /* Étiquette d'un point non conforme d'après les visites précédentes (plus récente d'abord) */
  function depuis(pointId, etat, precedentes, fdate) {
    var n = 0, dt = null;
    for (var i = 0; i < (precedentes || []).length; i++) {
      var x = (precedentes[i].items || []).filter(function (it) { return it.id === pointId; })[0];
      if (!x || x.etat === 'ok' || x.etat === 'na') break;
      n++; dt = precedentes[i].date;
    }
    if (!n) return 'Nouveau';
    return n >= 2 ? 'Depuis ' + (n + 1) + ' visites' : 'Depuis le ' + (fdate ? fdate(dt) : dt);
  }
  function droits(niveau, surcharge) {
    var d = Object.assign({}, NIVEAUX[niveau] || NIVEAUX.operateur);
    if (surcharge && surcharge[niveau]) Object.keys(surcharge[niveau]).forEach(function (k) { if (DROITS.indexOf(k) >= 0) d[k] = !!surcharge[niveau][k]; });
    return d;
  }
  /* Un document de visibilité v est-il visible pour le niveau n ? (interne : jamais côté client) */
  function visible(v, n) { return v !== 'interne' && (VIS_RANG[n] || 0) >= (VIS_RANG[v] || 9); }
  function masquer(id) {
    id = String(id || '');
    if (id.indexOf('@') > 0) { var p = id.split('@'); return p[0].charAt(0) + '•••••@' + p[1]; }
    var d = id.replace(/\D/g, ''); return d ? '•••-•••-' + d.slice(-4) : '•••';
  }

  var api = { SYSTEMES: SYSTEMES, NOM: NOM, LIB: LIB, LIB_CLIENT: LIB_CLIENT, NIVEAUX: NIVEAUX, NIVEAU_NOM: NIVEAU_NOM, DROITS: DROITS, MARGE: MARGE,
    systemeDe: systemeDe, pointsDuType: pointsDuType, etatEau: etatEau, pire: pire, itemsVisite: itemsVisite, etatsSystemes: etatsSystemes,
    compteurs: compteurs, score: score, pastilles: pastilles, verdict: verdict, resume: resume, depuis: depuis, droits: droits, visible: visible, masquer: masquer };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SAInsp = api;
})(typeof window !== 'undefined' ? window : this);
