/* Liste de contrôle d'intervention « Hivernement » (fermeture avec formation) — partagée par sa-terrain et sa-admin.
   Aucune dépendance : intégrée telle quelle dans terrain.html / admin.html (build). Expose window.SAHiv (navigateur) ou module.exports (Node).
   Stockage : table rapports_hivernage (aucune colonne nouvelle). sections[0] porte la saisie complète dans `hivernement` ;
   chaque section garde aussi `title` + `items` lisibles (« ✔ … » / « ☐ … ») pour SA Platform et les anciens rapports. */
(function (root) {
  'use strict';
  var LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF0AAABdCAMAAADwr5rxAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAA/UExURQBIh////4Clw0N5pzZuoQBIhwBIh7PJ3W6ZvRJWkcDS4fH1+RBUj6G709Dd6R5gl2CPtZGxyzBqn+Hp8Q5UjwM7wskAAAAKdFJOU8H////Fk//5/cHnDczVAAADKUlEQVRo3u2Y6ZbbIAyFR6i1Gfbt/Z+1EuAttadxG6enp+bH2GHwh7i6Aicfw4Xt4+Om3/SbftNv+k2/6Tf9pt/0m37Tb/p/R0c0V9FN1Epp5a+hW1vor9D+CrrXpV6jvYKOql9dvRTE/cz8Hj3loWM5B5ZzIPgztO56EaBUpt4YW6bAPK27GhfFFeeguLilR9d7fYtE2hOeEdqJ1Nbfni6c4YXudQ3V062rAmU85/eYeeGDld1GYk0XsY8yQ7ArLU/UKjp6UPWgmLfQR7GskxW34kRWu+osx0wf13S1ovHqDipjlz5HQuiZvlEm9hHJVN8GdcKRwfUbnWYzcPIaHWEZkTnmnFQ4QTe5pVI4dkf1jmRcrpAR5tvaS6LpU/tMykqiVM5XS0ZEW+dAHTEoxfSkbUBbQydfxnM7sAlW2b5cL0crWyX6qCIOVfMi7dQ7HO52rzg90F15Nh3l9BV0YQ9DH779MR0PIx/CeEhHyGcnAt6BYC7jCMf0EQCfl6cyt3QL+lAZDwDjSTqfVhPdKNDp84hOy9Iw+RiFQOPRz8ddwtL7A49JFiz9d0U3DqgWjzxjCG17DaZM6wDt+Dloe41i1Vo/BP5ITayUSRqcOXZkADUk0H0iJ0Osz6/pXlPASP2e9khQAhc6we1XfnctpFCzMzYPPdBlW5rlQdusBujiH9CbHQNwoUzyj4/KNNlq94Yuq1pf0MlNihpAopNNr3yxphupdBN8Q9fwC7qHqVlahtunk7iQlVWPdNCCo9qjlw4asTaAMgHJo1t6hvq2GR/p5EQJ7cyZ6WU9h+5zk9ayJZgG5EY3bQBOE7mfdG/KpsNzdRKjZhdBk8hlrAJXVrFQY6dZfeuWJKFZ7wQNv0tXMO97mTC2llJLH2mla+0g+65WGbTS0GKzz1T8Ht2r5QUi8JsLFQs4EdteQsHmaFXiV2UCSz4NSX1N5zg/F6azZKRqPXF6rPbWZxrvNJ+X0Rk/Xkcn/JV0+nJ3JX2YdC87NfVoJTz9FfBvfZMv/+TvBOUNyhxNVN6jTHkRvfytrJZl9vLYsaaXt/r9FQq91+/lqTDL0/Qr2/cfwZfNOgkFMZkAAAAASUVORK5CYII=';
  var SECTIONS = [
    { id: 'secu', titre: 'Sécurité et préparation', col: 'Vérification', items: [
      { t: 'EPI portés par toute l’équipe (bottes, gants, lunettes, protection auditive si compresseur)' },
      { t: 'Alimentation électrique des pompes, chauffe-eau et système de traitement coupée et verrouillée' },
      { t: 'Zone de travail délimitée et accès public bloqué (cônes, ruban)' },
      { t: 'Plan du parc revu : emplacement des valves, drains, écumoires et salle mécanique' },
      { t: 'Matériel et antigel biodégradable en quantité suffisante sur place (voir section 8)' },
      { t: 'Météo vérifiée : travaux prévus dans une fenêtre sans gel ni pluie battante' }] },
    { id: 'p1', titre: 'Phase 1 — Vidange', col: 'Tâche', num: true, items: [
      { n: '1', t: 'Vidanger le bassin au complet (section « Vidange du bassin »)', crit: true },
      { n: '14', t: 'Ouvrir toutes les vannes de vidange de la salle mécanique' },
      { n: '15', t: 'Vidanger les filtres (bouchon au bas du filtre), remettre les bouchons, valves à 50 %' },
      { n: '16', t: 'Vidanger les chauffe-eau et/ou thermopompes (protéger de la neige et de la glace si extérieur)' },
      { n: '17', t: 'Vidanger les tamis de pompes (retirer les bouchons de drainage)' },
      { n: '20', t: 'Vidanger les produits chimiques des réservoirs (niveau le plus bas possible)' },
      { n: '21', t: 'Rincer les conduites d’injection en pompant de l’eau, puis vidanger. Démonter injecteurs et les ranger' },
      { n: '22', t: 'Dévisser les clapets anti-retour à la sortie des pompes pour évacuer l’eau de la colonne' }] },
    { id: 'p2', titre: 'Phase 2 — Retrait et démontage', col: 'Tâche', num: true, items: [
      { n: '2', t: 'Retirer les boules et anneaux de serrage des retours d’eau' },
      { n: '3', t: 'Retirer grilles de drain de fond, paniers d’écumoires, bouchons de bronze de prise d’aspiration (et vase communicant)' },
      { n: '4', t: 'Enlever toutes les échelles, équipements de plage, lumières et les remiser' },
      { n: '23', t: 'Débrancher et démonter le système de traitement automatisé. Sondes ORP, pH et conductivité dans un liquide de remisage' },
      { n: '24', t: 'Isoler, drainer et retirer le double clapet DAR, réducteur de pression et anti-bélier (si présents) hors du gel' }] },
    { id: 'p3', titre: 'Phase 3 — Protection des conduits et antigel', col: 'Tâche', num: true, items: [
      { n: '5', t: 'Aspirer l’eau des conduits vers la salle mécanique (aspirateur de chantier) ou souffler à l’air comprimé' },
      { n: '6', t: 'Ajouter l’antigel biodégradable : drain de fond, retour d’eau, écumoire, aspirateur, vase communicant et conduit de lumière' },
      { n: '7', t: 'Installer les bouchons expansibles dans les drains de fond' },
      { n: '8', t: 'Installer bouchons filetés 1 ½ po NPT sur sorties de retour et conduits de lumière' },
      { n: '9', t: 'Installer bouchons filetés 2 po NPT sur les prises d’aspiration (si présentes)' },
      { n: '10', t: 'Installer bouchons filetés 1 ½ po NPT dans les deux ouvertures au fond de chaque écumoire (voir schéma)' },
      { n: '11', t: 'Installer les ensembles protecteurs en styromousse à l’intérieur des écumoires' },
      { n: '12', t: 'Mettre les ensembles de styromousse dans la réserve de drain de fond.', b: 'VALIDER l’étanchéité et le bon fonctionnement du clapet de tige hydrostatique', crit: true }] },
    { id: 'p4', titre: 'Phase 4 — Remise d’eau contrôlée', col: 'Tâche', num: true, items: [
      { n: '13', t: 'Remettre de l’eau dans le bassin jusqu’à 16 po sous les retours.', b: 'Vitesse de remplissage : 1 po/heure', crit: true },
      { n: '18', t: 'Remettre les bouchons de drainage sur les tamis et remplir de lubrifiant (Lubrigel) jusqu’au niveau des joints mécaniques' },
      { n: '19', t: 'Installer le couvercle sur chaque tamis (éviter l’évaporation de l’antigel)' }] },
    { id: 'p5', titre: 'Phase 5 — Vérifications finales', col: 'Vérification', num: true, items: [
      { n: '25', t: 'Revérifier tout le système : aucune valve oubliée ouverte ou fermée à tort. La plupart des valves ouvertes sont à 50 %', crit: true },
      { n: '—', t: 'Tuyauterie vide ou avec antigel, selon la configuration. Aucun point bas où l’eau peut stagner' },
      { n: '—', t: 'Bouchons de 1 ½ po et 2 po installés et serrés, téflon sur les filets' },
      { n: '—', t: 'Équipements remisés (échelles, lumières, pièces) et identifiés pour le printemps' },
      { n: '—', t: 'Système de traitement remisé, sondes dans liquide de remisage' },
      { n: '—', t: 'Photos prises : salle mécanique, valves, bouchons, niveau d’eau du bassin' },
      { n: '—', t: 'Zone nettoyée, matériel rangé, aucun déchet chimique laissé sur place' }] },
    { id: 'mat', titre: 'Matériel et pièces', col: 'Matériel', col2: 'Pièces de rechange', items: [
      { t: 'Antigel biodégradable' }, { t: 'Pinces et tournevis divers' }, { t: 'Téflon' }, { t: 'Pompe à puisard et boyau' },
      { t: 'Ensembles styromousse (écumoires et drains de fond)' }, { t: 'Corde pour fichier (lumières)' }, { t: 'Aspirateur de chantier (shop-vac)' },
      { t: 'Clapet de tige hydrostatique (si piscine l’exige)', g: 2 }, { t: 'Bouchons 1 ½ po NPT', g: 2 }, { t: 'Bouchons 2 po NPT', g: 2 },
      { t: 'Bouchons expansibles (drains de fond)', g: 2 }, { t: 'Lubrigel (lubrifiant tamis de pompes)', g: 2 }, { t: 'Couvercles de tamis', g: 2 }, { t: 'Bouchons de drainage de tamis', g: 2 }] },
    { id: 'form', titre: 'Formation des employés', col: 'Sujet de formation', items: [
      { t: 'Séquence complète de l’hivernement (phases 1 à 5) et logique de l’ordre des étapes' },
      { t: 'Identification des valves : celles qui se ferment et celles qui restent à 50 %' },
      { t: 'Installation des bouchons filetés et expansibles, dont les bouchons 1 ½ po et 2 po' },
      { t: 'Clapet de tige hydrostatique : test d’étanchéité et de fonctionnement' },
      { t: 'Remise d’eau à 1 po/heure et contrôle du niveau de 16 po' },
      { t: 'Manipulation sécuritaire de l’antigel, des produits chimiques et de l’air comprimé' },
      { t: 'Démonstration pratique réalisée sur le site, avec évaluation des participants' }] }
  ];
  /* Numéro affiché de chaque section (1 = informations générales, 10 = remarques, 11 = validation) */
  SECTIONS.forEach(function (s, i) { s.no = i + 2; s.items.forEach(function (it, j) { it.k = s.id + '-' + j; }); });
  var INFO = [['date', 'Date', 'date'], ['site', 'Site', 'text'], ['heure_debut', 'Heure début', 'time'], ['heure_fin', 'Heure fin', 'time'],
    ['chef', 'Chef d’équipe', 'text'], ['temperature', 'Température', 'text'], ['equipe', 'Équipe présente', 'text', true], ['bassins', 'Bassin(s) / autres équipements', 'text', true]];
  var TIPS = ['L’idée de base d’un hivernement est d’éviter que les tuyaux gèlent et se cassent, et que le gel du sol soulève la piscine.',
    'Selon la configuration, il n’est pas nécessaire de remplir toute la tuyauterie d’antigel. Dès qu’on voit l’antigel sortir à l’autre extrémité de la conduite soufflée, on peut arrêter et mettre les bouchons.'];
  var ALERTE = 'L’HIVERNEMENT N’EST PAS UNE COURSE. UNE MAUVAISE EXÉCUTION PEUT AVOIR DES CONSÉQUENCES DE PLUSIEURS MILLIERS DE DOLLARS.';
  var TITRE = 'Hivernement';

  function blank(o) {
    o = o || {};
    return { v: 1, info: { date: o.date || '', site: o.site || '', heure_debut: '', heure_fin: '', chef: o.chef || '', temperature: '', equipe: '', bassins: '' },
      c: {}, employes: [], remarques: '', responsable: o.responsable == null ? 'Maxime' : o.responsable, courriel: o.courriel || '', envois: [] };
  }
  function norm(d) {
    var b = blank(); d = d || {};
    return { v: 1, info: Object.assign(b.info, d.info || {}), c: Object.assign({}, d.c || {}), employes: (d.employes || []).map(function (e) { return { nom: e.nom || '', formation: !!e.formation, demo: !!e.demo }; }),
      remarques: d.remarques || '', responsable: d.responsable == null ? b.responsable : d.responsable, courriel: d.courriel || '', envois: (d.envois || []).slice() };
  }
  /* Un rapport d'hivernage est-il une liste de contrôle « Hivernement » ? */
  function isChecklist(r) { return !!(r && Array.isArray(r.sections) && r.sections[0] && r.sections[0].hivernement); }
  function fromReport(r) { return isChecklist(r) ? norm(r.sections[0].hivernement) : null; }
  function photosOf(r) { return isChecklist(r) ? (r.sections[0].photos || []) : []; }

  /* Avancement : toutes les cases, comme le formulaire papier (formation des employés nommés comprise) */
  function progress(d) {
    d = norm(d); var total = 0, done = 0;
    SECTIONS.forEach(function (s) { s.items.forEach(function (it) { total++; if (d.c[it.k]) done++; }); });
    d.employes.forEach(function (e) { if (!String(e.nom).trim()) return; total += 2; if (e.formation) done++; if (e.demo) done++; });
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
  }
  function label(it) { return it.t + (it.b ? ' ' + it.b : ''); }
  function manquants(d) {
    d = norm(d); var out = [];
    SECTIONS.forEach(function (s) { if (s.id === 'mat') return; s.items.forEach(function (it) { if (!d.c[it.k]) out.push((it.n && it.n !== '—' ? it.n + '. ' : '') + label(it)); }); });
    return out;
  }
  function critiquesManquants(d) {
    d = norm(d); var out = [];
    SECTIONS.forEach(function (s) { s.items.forEach(function (it) { if (it.crit && !d.c[it.k]) out.push(it.n + '. ' + label(it)); }); });
    return out;
  }

  /* Ligne de rapports_hivernage (sans id / created_*) à partir de la saisie */
  function toReport(d, base, photos) {
    d = norm(d); var p = progress(d), i = d.info, b = base || {};
    var s0 = { id: 'hivernement', title: 'Liste de contrôle d’hivernement', tag: critiquesManquants(d).length ? 'urgent' : '',
      items: ['Avancement : ' + p.done + ' / ' + p.total + ' cases (' + p.pct + ' %)'].concat(INFO.filter(function (f) { return i[f[0]]; }).map(function (f) { return f[1] + ' : ' + i[f[0]]; })),
      photos: photos || [], hivernement: d };
    var secs = [s0].concat(SECTIONS.map(function (s) {
      return { id: 'hv-' + s.id, title: s.no + '. ' + s.titre, tag: '', photos: [], items: s.items.map(function (it) { return (d.c[it.k] ? '✔ ' : '☐ ') + (it.n && it.n !== '—' ? it.n + '. ' : '') + label(it); }) };
    }));
    var emp = d.employes.filter(function (e) { return String(e.nom).trim(); });
    if (emp.length) secs.push({ id: 'hv-employes', title: 'Employés formés', tag: '', photos: [], items: emp.map(function (e) { return e.nom + ' — formation ' + (e.formation ? 'complétée' : 'non complétée') + ', démonstration ' + (e.demo ? 'réussie' : 'non réussie'); }) });
    return Object.assign({}, b, { site_id: b.site_id || '', site_nom: i.site || b.site_nom || '', client: b.client || '', objet: TITRE + ' — fermeture avec formation',
      titre: TITRE + ' — ' + (i.site || b.site_nom || ''), sous_titre: 'Liste de contrôle d’intervention', date_rapport: b.date_rapport || i.date || '', date_inspection: i.date || b.date_inspection || '',
      prepare_par: b.prepare_par || 'Soucy Aquatik', technicien: i.chef || b.technicien || '', sections: secs, plan: b.plan || [], suivi: b.suivi || [], timeline: b.timeline || { q1: '', q2: '', q3: '', q4: '' },
      callout: d.remarques || '', signataire_sa: i.chef || '', signataire_client: d.responsable || '' });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var CSS = ':root{--bleu:#1B4F8C;--bleu-med:#2E6DA4;--bleu-clair:#E8EEF7;--vert:#1a7a4a;--rouge:#8b1a1a;--grey:#5A6270;--line:#C5CFDD;--ink:#1d2330}*{box-sizing:border-box}'
    + 'body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;color:var(--ink);margin:0;background:#f3f5f9;font-size:14px;line-height:1.4}'
    + '.page{max-width:880px;margin:24px auto;background:#fff;padding:0 0 36px;box-shadow:0 2px 10px rgba(0,0,0,.08)}'
    + 'header.top{display:flex;justify-content:space-between;align-items:center;background:var(--bleu);color:#fff;padding:16px 28px}header.top h1{margin:0;font-size:22px;letter-spacing:.3px}header.top .sub{font-size:13px;opacity:.9;margin-top:2px}header.top img{height:64px;width:64px;display:block}'
    + '.body{padding:0 28px}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 6px}.kpi{border:1px solid var(--line);border-top:4px solid var(--bleu);padding:10px 12px}.kpi .val{font-size:22px;font-weight:700;color:var(--bleu)}.kpi .lbl{font-size:12px;color:var(--grey);text-transform:uppercase;letter-spacing:.5px}'
    + 'h2{background:var(--bleu);color:#fff;font-size:13.5px;text-transform:uppercase;letter-spacing:.6px;padding:7px 10px;margin:22px 0 8px;border-radius:3px}'
    + '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.field{display:flex;align-items:baseline;gap:6px;border-bottom:1px solid var(--line);padding:4px 0}.field label{font-weight:600;white-space:nowrap;color:var(--grey)}.field span{flex:1;padding:2px 4px;min-height:1.4em}.wide{grid-column:span 2}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:4px}th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}th{background:var(--bleu-clair);color:var(--bleu);font-size:12.5px}'
    + 'td.cb,th.cb{width:44px;text-align:center}td.num{width:52px;text-align:center;color:var(--grey);font-weight:600}.box{display:inline-block;width:18px;height:18px;border:1.5px solid var(--bleu);border-radius:3px;line-height:15px;font-size:14px;font-weight:700;color:#fff;text-align:center}.box.on{background:var(--bleu)}'
    + 'tr.done td{color:#7a8190}.critical td.t{font-weight:700;color:var(--rouge)}tr.done.critical td.t{color:#7a8190}'
    + '.alert{border:2px solid var(--rouge);background:#fbeaea;color:#5c1510;padding:10px 12px;font-weight:700;margin:14px 0;border-radius:3px}.tip{border-left:4px solid var(--bleu-med);background:#f4f7fb;padding:8px 12px;margin:10px 0}.tip strong{color:var(--bleu)}ul.clean{margin:4px 0 0 18px;padding:0}ul.clean li{margin:3px 0}'
    + '.notes{min-height:70px;white-space:pre-wrap}.sign-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px}.sign-box{border:1px solid var(--line);height:70px;padding:6px 8px;font-size:12px;color:var(--grey)}.sign-box b{display:block;color:var(--ink);font-size:13px;margin-top:4px}'
    + '.photos{display:flex;flex-wrap:wrap;gap:8px}.photos img{max-width:200px;max-height:160px;border:1px solid var(--line)}.foot{color:var(--grey);font-size:11px;margin-top:14px}'
    + '@media print{body{background:#fff;font-size:11.5px}.page{box-shadow:none;margin:0;padding:0 0 12px;max-width:none}header.top,h2,th,.box.on,.kpi{-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{break-after:avoid}table,tr,.sign-row,.tip,.alert{break-inside:avoid}}'
    + '@media (max-width:600px){.info-grid,.sign-row,.kpis{grid-template-columns:1fr}.wide{grid-column:auto}}';

  /* Document autonome (impression, pièce jointe envoyée au client) — même présentation que le formulaire papier */
  function html(d, opts) {
    d = norm(d); opts = opts || {}; var p = progress(d), i = d.info, E = esc;
    var box = function (on) { return '<span class="box' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span>'; };
    var row = function (it, withNum) { var on = !!d.c[it.k]; return '<tr class="' + (on ? 'done' : '') + (it.crit ? ' critical' : '') + '"><td class="cb">' + box(on) + '</td>' + (withNum ? '<td class="num">' + E(it.n) + '</td>' : '') + '<td class="t">' + E(it.t) + (it.b ? ' <strong>' + E(it.b) + '</strong>' : '') + '</td></tr>'; };
    var h = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + E(TITRE + ' — ' + (i.site || '')) + '</title><style>' + CSS + '</style></head><body><div class="page">'
      + '<header class="top"><div><h1>' + E(TITRE + ' — ' + (i.site || '')) + '</h1><div class="sub">Liste de contrôle d’intervention · Fermeture avec formation</div></div><img src="' + LOGO + '" alt="Soucy Aquatik"></header><div class="body">'
      + '<div class="kpis"><div class="kpi"><div class="val">' + p.total + '</div><div class="lbl">Cases au total</div></div><div class="kpi"><div class="val">' + p.done + '</div><div class="lbl">Cases cochées</div></div><div class="kpi"><div class="val">' + p.pct + ' %</div><div class="lbl">Avancement</div></div></div>'
      + '<h2>1. Informations générales</h2><div class="info-grid">' + INFO.map(function (f) { return '<div class="field' + (f[3] ? ' wide' : '') + '"><label>' + E(f[1]) + ' :</label><span>' + E(i[f[0]]) + '</span></div>'; }).join('') + '</div>';
    SECTIONS.forEach(function (s) {
      h += '<h2>' + s.no + '. ' + E(s.titre) + '</h2>';
      if (s.col2) {
        var a = s.items.filter(function (it) { return it.g !== 2; }), b = s.items.filter(function (it) { return it.g === 2; }), n = Math.max(a.length, b.length), r = '';
        for (var j = 0; j < n; j++) r += '<tr>' + [a[j], b[j]].map(function (it) { return it ? '<td class="cb">' + box(!!d.c[it.k]) + '</td><td>' + E(it.t) + '</td>' : '<td class="cb"></td><td></td>'; }).join('') + '</tr>';
        h += '<table><tr><th class="cb">✔</th><th>' + E(s.col) + '</th><th class="cb">✔</th><th>' + E(s.col2) + '</th></tr>' + r + '</table>';
      } else h += '<table><tr><th class="cb">✔</th>' + (s.num ? '<th class="num">#</th>' : '') + '<th>' + E(s.col) + '</th></tr>' + s.items.map(function (it) { return row(it, s.num); }).join('') + '</table>';
      if (s.id === 'p5') h += '<div class="tip"><strong>Bon à savoir :</strong><ul class="clean">' + TIPS.map(function (t) { return '<li>' + E(t) + '</li>'; }).join('') + '</ul></div><div class="alert">' + E(ALERTE) + '</div>';
      if (s.id === 'form') {
        var emp = d.employes.filter(function (e) { return String(e.nom).trim(); });
        while (emp.length < (opts.blankRows == null ? 2 : opts.blankRows)) emp.push(null);
        h += '<table style="margin-top:12px;"><tr><th>Employé (nom)</th><th style="width:150px;">Formation complétée</th><th style="width:150px;">Démonstration réussie</th></tr>'
          + emp.map(function (e) { return '<tr><td style="height:30px;">' + E(e ? e.nom : '') + '</td><td>' + box(!!(e && e.formation)) + '</td><td>' + box(!!(e && e.demo)) + '</td></tr>'; }).join('') + '</table>';
      }
    });
    var ph = (opts.photos || []).filter(function (x) { return x && /^data:image|^https?:/.test(x.data || x.url || ''); });
    h += '<h2>10. Remarques et anomalies</h2><table><tr><td class="notes">' + E(d.remarques) + '</td></tr></table>'
      + (ph.length ? '<div class="photos">' + ph.map(function (x) { return '<img src="' + E(x.data || x.url) + '" alt="' + E(x.name || 'Photo') + '">'; }).join('') + '</div>' : '')
      + '<h2>11. Validation</h2><div class="sign-row"><div class="sign-box">Chef d’équipe — Signature et date<b>' + E(i.chef) + '</b></div><div class="sign-box">Responsable' + (d.responsable ? ' (' + E(d.responsable) + ')' : '') + ' — Signature et date</div></div>'
      + '<div class="foot">Soucy Aquatik · liste de contrôle générée par SA Platform</div></div></div></body></html>';
    return h;
  }

  /* Corps du courriel au client */
  function texte(d) {
    d = norm(d); var p = progress(d), i = d.info, m = manquants(d);
    return 'Bonjour,\n\nVoici la liste de contrôle de l’hivernement' + (i.site ? ' de ' + i.site : '') + (i.date ? ' réalisé le ' + i.date : '') + '.\n\n'
      + 'Avancement : ' + p.done + ' / ' + p.total + ' cases cochées (' + p.pct + ' %).\n'
      + (m.length ? '\nÉtapes non cochées :\n' + m.slice(0, 15).map(function (x) { return '• ' + x; }).join('\n') + (m.length > 15 ? '\n• … et ' + (m.length - 15) + ' autre(s)' : '') + '\n' : '\nToutes les étapes de l’hivernement ont été réalisées.\n')
      + (d.remarques ? '\nRemarques : ' + d.remarques + '\n' : '')
      + '\nLa liste de contrôle complète est jointe à ce courriel.\n\nSoucy Aquatik';
  }
  function fichier(d) { d = norm(d); return ('Hivernement ' + (d.info.site || '') + ' ' + (d.info.date || '')).trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') + '.html'; }

  var api = { SECTIONS: SECTIONS, INFO: INFO, TIPS: TIPS, ALERTE: ALERTE, LOGO: LOGO, blank: blank, norm: norm, isChecklist: isChecklist, fromReport: fromReport, photosOf: photosOf,
    progress: progress, manquants: manquants, critiquesManquants: critiquesManquants, toReport: toReport, html: html, texte: texte, fichier: fichier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SAHiv = api;
})(typeof window !== 'undefined' ? window : this);
