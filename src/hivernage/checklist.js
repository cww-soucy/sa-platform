/* Liste de contrôle d'intervention « Hivernement » (type au choix : fermeture avec formation, complète, dormance, remise en service…) — partagée par sa-terrain et sa-admin.
   Aucune dépendance : intégrée telle quelle dans terrain.html / admin.html (build). Expose window.SAHiv (navigateur) ou module.exports (Node).
   Stockage : table rapports_hivernage (aucune colonne nouvelle). sections[0] porte la saisie complète dans `hivernement` ;
   chaque section garde aussi `title` + `items` lisibles (« ✔ … » / « ☐ … ») pour SA Platform et les anciens rapports. */
(function (root) {
  'use strict';
  var LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF0AAABdCAMAAADwr5rxAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAA/UExURQBIh////4Clw0N5pzZuoQBIhwBIh7PJ3W6ZvRJWkcDS4fH1+RBUj6G709Dd6R5gl2CPtZGxyzBqn+Hp8Q5UjwM7wskAAAAKdFJOU8H////Fk//5/cHnDczVAAADKUlEQVRo3u2Y6ZbbIAyFR6i1Gfbt/Z+1EuAttadxG6enp+bH2GHwh7i6Aicfw4Xt4+Om3/SbftNv+k2/6Tf9pt/0m37Tb/p/R0c0V9FN1Epp5a+hW1vor9D+CrrXpV6jvYKOql9dvRTE/cz8Hj3loWM5B5ZzIPgztO56EaBUpt4YW6bAPK27GhfFFeeguLilR9d7fYtE2hOeEdqJ1Nbfni6c4YXudQ3V062rAmU85/eYeeGDld1GYk0XsY8yQ7ArLU/UKjp6UPWgmLfQR7GskxW34kRWu+osx0wf13S1ovHqDipjlz5HQuiZvlEm9hHJVN8GdcKRwfUbnWYzcPIaHWEZkTnmnFQ4QTe5pVI4dkf1jmRcrpAR5tvaS6LpU/tMykqiVM5XS0ZEW+dAHTEoxfSkbUBbQydfxnM7sAlW2b5cL0crWyX6qCIOVfMi7dQ7HO52rzg90F15Nh3l9BV0YQ9DH779MR0PIx/CeEhHyGcnAt6BYC7jCMf0EQCfl6cyt3QL+lAZDwDjSTqfVhPdKNDp84hOy9Iw+RiFQOPRz8ddwtL7A49JFiz9d0U3DqgWjzxjCG17DaZM6wDt+Dloe41i1Vo/BP5ITayUSRqcOXZkADUk0H0iJ0Osz6/pXlPASP2e9khQAhc6we1XfnctpFCzMzYPPdBlW5rlQdusBujiH9CbHQNwoUzyj4/KNNlq94Yuq1pf0MlNihpAopNNr3yxphupdBN8Q9fwC7qHqVlahtunk7iQlVWPdNCCo9qjlw4asTaAMgHJo1t6hvq2GR/p5EQJ7cyZ6WU9h+5zk9ayJZgG5EY3bQBOE7mfdG/KpsNzdRKjZhdBk8hlrAJXVrFQY6dZfeuWJKFZ7wQNv0tXMO97mTC2llJLH2mla+0g+65WGbTS0GKzz1T8Ht2r5QUi8JsLFQs4EdteQsHmaFXiV2UCSz4NSX1N5zg/F6azZKRqPXF6rPbWZxrvNJ+X0Rk/Xkcn/JV0+nJ3JX2YdC87NfVoJTz9FfBvfZMv/+TvBOUNyhxNVN6jTHkRvfytrJZl9vLYsaaXt/r9FQq91+/lqTDL0/Qr2/cfwZfNOgkFMZkAAAAASUVORK5CYII=';
  /* Gabarit « Piscine » : le formulaire papier d’origine (clés p1-0… inchangées pour les rapports déjà faits) */
  var PISCINE = [
    { id: 'secu', titre: 'Sécurité et préparation', col: 'Vérification', commun: true, items: [
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
    { id: 'mat', titre: 'Matériel et pièces', col: 'Matériel', col2: 'Pièces de rechange', commun: true, items: [
      { t: 'Antigel biodégradable' }, { t: 'Pinces et tournevis divers' }, { t: 'Téflon' }, { t: 'Pompe à puisard et boyau' },
      { t: 'Ensembles styromousse (écumoires et drains de fond)' }, { t: 'Corde pour fichier (lumières)' }, { t: 'Aspirateur de chantier (shop-vac)' },
      { t: 'Clapet de tige hydrostatique (si piscine l’exige)', g: 2 }, { t: 'Bouchons 1 ½ po NPT', g: 2 }, { t: 'Bouchons 2 po NPT', g: 2 },
      { t: 'Bouchons expansibles (drains de fond)', g: 2 }, { t: 'Lubrigel (lubrifiant tamis de pompes)', g: 2 }, { t: 'Couvercles de tamis', g: 2 }, { t: 'Bouchons de drainage de tamis', g: 2 }] },
    { id: 'form', titre: 'Formation des employés', col: 'Sujet de formation', commun: true, items: [
      { t: 'Séquence complète de l’hivernement (phases 1 à 5) et logique de l’ordre des étapes' },
      { t: 'Identification des valves : celles qui se ferment et celles qui restent à 50 %' },
      { t: 'Installation des bouchons filetés et expansibles, dont les bouchons 1 ½ po et 2 po' },
      { t: 'Clapet de tige hydrostatique : test d’étanchéité et de fonctionnement' },
      { t: 'Remise d’eau à 1 po/heure et contrôle du niveau de 16 po' },
      { t: 'Manipulation sécuritaire de l’antigel, des produits chimiques et de l’air comprimé' },
      { t: 'Démonstration pratique réalisée sur le site, avec évaluation des participants' }] }
  ];
  var INFO = [['date', 'Date', 'date'], ['site', 'Site', 'text'], ['heure_debut', 'Heure début', 'time'], ['heure_fin', 'Heure fin', 'time'],
    ['chef', 'Chef d’équipe', 'text'], ['temperature', 'Température', 'text'], ['equipe', 'Équipe présente', 'text', true], ['bassins', 'Bassin(s) / autres équipements', 'text', true]];
  var TIPS = ['L’idée de base d’un hivernement est d’éviter que les tuyaux gèlent et se cassent, et que le gel du sol soulève la piscine.',
    'Selon la configuration, il n’est pas nécessaire de remplir toute la tuyauterie d’antigel. Dès qu’on voit l’antigel sortir à l’autre extrémité de la conduite soufflée, on peut arrêter et mettre les bouchons.'];
  var ALERTE = 'L’HIVERNEMENT N’EST PAS UNE COURSE. UNE MAUVAISE EXÉCUTION PEUT AVOIR DES CONSÉQUENCES DE PLUSIEURS MILLIERS DE DOLLARS.';
  var TITRE = 'Hivernement';

  /* Sections communes à tous les ouvrages (fusionnées quand un site en a plusieurs) : mêmes libellés que la piscine quand c’est la même vérification */
  var SECU_EXT = function (plan) {
    return { id: 'secu', titre: 'Sécurité et préparation', col: 'Vérification', commun: true, items: [
      { t: PISCINE[0].items[0].t },
      { t: 'Alimentation électrique des pompes, du contrôleur et du système de traitement coupée et verrouillée' },
      { t: PISCINE[0].items[2].t },
      { t: plan },
      { t: PISCINE[0].items[5].t }] };
  };
  /* PREMIER JET (2026-10-22) à valider par Soucy Aquatik — modifiable dans sa-admin › Hivernage › Gabarits */
  var JEUXDEAU = [
    SECU_EXT('Plan du site revu : bassin d’équilibre, salle mécanique, collecteurs, valves et lignes d’alimentation de chaque jeu'),
    { id: 'p1', titre: 'Phase 1 — Arrêt et isolement', col: 'Tâche', num: true, items: [
      { n: '1', t: 'Mettre le contrôleur des jeux (séquenceur) hors service et désactiver le bouton d’activation ou le détecteur' },
      { n: '2', t: 'Fermer l’entrée d’eau potable et la valve d’appoint du bassin d’équilibre', crit: true },
      { n: '3', t: 'Isoler, drainer et retirer le dispositif antirefoulement (DAR) et le réducteur de pression, puis les ranger hors du gel', crit: true },
      { n: '4', t: 'Couper et cadenasser les pompes, le système UV et le contrôleur de chimie' }] },
    { id: 'p2', titre: 'Phase 2 — Vidange', col: 'Tâche', num: true, items: [
      { n: '5', t: 'Vidanger le bassin d’équilibre au complet (pompe submersible) et retirer les débris et le sable' },
      { n: '6', t: 'Ouvrir les drains bas des collecteurs et toutes les valves (manuelles et solénoïdes) des jeux' },
      { n: '7', t: 'Vidanger les filtres, les tamis de pompes, la chambre UV et l’échangeur (retirer les bouchons de drainage)' },
      { n: '8', t: 'Retirer la lampe UV et le manchon de quartz (si présents) et les ranger hors du gel' },
      { n: '9', t: 'Vidanger les réservoirs de produits chimiques, rincer les conduites d’injection. Sondes ORP et pH dans un liquide de remisage' }] },
    { id: 'p3', titre: 'Phase 3 — Purge des conduites', col: 'Tâche', num: true, items: [
      { n: '10', t: 'Souffler chaque ligne de jeu à l’air comprimé, une à la fois, jusqu’à ce qu’il ne sorte plus que de l’air.', b: 'Respecter la pression maximale du fabricant', crit: true },
      { n: '11', t: 'Souffler les conduites des drains de surface vers le bassin d’équilibre' },
      { n: '12', t: 'Ajouter de l’antigel biodégradable dans les siphons et les points bas qui ne se vident pas' },
      { n: '13', t: 'Laisser les valves des collecteurs dans la position d’hiver prévue (ouvertes ou à 50 %)' }] },
    { id: 'p4', titre: 'Phase 4 — Protection des équipements de surface', col: 'Tâche', num: true, items: [
      { n: '14', t: 'Retirer ou capuchonner les buses et gicleurs démontables, les ranger identifiés pour le printemps' },
      { n: '15', t: 'Couvrir les drains de surface (sable, feuilles, débris)' },
      { n: '16', t: 'Refermer et verrouiller les trappes du bassin d’équilibre et de la chambre des valves' },
      { n: '17', t: 'Installer l’affiche « Jeux d’eau fermés pour l’hiver »' }] },
    { id: 'p5', titre: 'Phase 5 — Vérifications finales', col: 'Vérification', num: true, items: [
      { n: '18', t: 'Revérifier tout le système : eau potable fermée, aucune ligne pleine, valves dans la position d’hiver', crit: true },
      { n: '—', t: 'Contrôleur programmé hors saison, disjoncteurs identifiés' },
      { n: '—', t: 'Photos prises : salle mécanique, collecteurs, bassin d’équilibre vide, valves' },
      { n: '—', t: PISCINE[5].items[6].t }] },
    { id: 'mat', titre: 'Matériel et pièces', col: 'Matériel', col2: 'Pièces de rechange', commun: true, items: [
      { t: 'Compresseur, boyaux et raccords de soufflage' }, { t: 'Pompe à puisard et boyau' }, { t: 'Antigel biodégradable' }, { t: 'Pinces et tournevis divers' }, { t: 'Téflon' },
      { t: 'Capuchons de buses', g: 2 }, { t: 'Couvercles de drains de surface', g: 2 }, { t: 'Joints et bouchons de drainage', g: 2 }] },
    { id: 'form', titre: 'Formation des employés', col: 'Sujet de formation', commun: true, items: [
      { t: 'Séquence complète de l’hivernement des jeux d’eau (phases 1 à 5)' },
      { t: 'Identification des lignes de chaque jeu et des valves du collecteur' },
      { t: 'Soufflage sécuritaire à l’air comprimé (pression, protection des yeux et des oreilles)' },
      { t: PISCINE[7].items[6].t }] }
  ];
  var FONTAINE = [
    SECU_EXT('Plan du site revu : bassin ou vasque, réservoir, salle mécanique, valves et alimentation des buses'),
    { id: 'p1', titre: 'Phase 1 — Arrêt et isolement', col: 'Tâche', num: true, items: [
      { n: '1', t: 'Arrêter les pompes, l’éclairage et la minuterie, puis couper et cadenasser l’alimentation électrique' },
      { n: '2', t: 'Fermer l’appoint d’eau automatique (flotteur ou solénoïde) et l’entrée d’eau potable', crit: true },
      { n: '3', t: 'Isoler, drainer et retirer le dispositif antirefoulement (DAR) et le ranger hors du gel', crit: true }] },
    { id: 'p2', titre: 'Phase 2 — Vidange et nettoyage', col: 'Tâche', num: true, items: [
      { n: '4', t: 'Vidanger le bassin (ou la vasque) et le réservoir au complet' },
      { n: '5', t: 'Nettoyer le fond et les parois : débris, algues et dépôts de calcaire' },
      { n: '6', t: 'Vidanger les pompes, les filtres et les tamis (retirer les bouchons de drainage)' },
      { n: '7', t: 'Retirer la pompe submersible (si présente), la nettoyer et la remiser selon les directives du fabricant' },
      { n: '8', t: 'Vidanger les réservoirs de produits chimiques et rincer les conduites d’injection (si présents)' }] },
    { id: 'p3', titre: 'Phase 3 — Démontage et purge', col: 'Tâche', num: true, items: [
      { n: '9', t: 'Retirer les buses et les jets, les nettoyer et les ranger identifiés pour le printemps' },
      { n: '10', t: 'Souffler à l’air comprimé chaque conduite d’alimentation des buses jusqu’à ce qu’il ne sorte plus que de l’air', crit: true },
      { n: '11', t: 'Retirer les luminaires submersibles ou vérifier leur étanchéité selon le fabricant' },
      { n: '12', t: 'Ajouter de l’antigel biodégradable dans les siphons et les points bas qui ne se vident pas' }] },
    { id: 'p4', titre: 'Phase 4 — Protection', col: 'Tâche', num: true, items: [
      { n: '13', t: 'Installer les bouchons sur les sorties de buses et sur l’appoint d’eau' },
      { n: '14', t: 'Laisser le drain du bassin ouvert (eau de pluie et de fonte) ou installer la couverture d’hiver, selon la fontaine' },
      { n: '15', t: 'Protéger les éléments décoratifs (housse, panneaux) contre le gel et la neige' }] },
    { id: 'p5', titre: 'Phase 5 — Vérifications finales', col: 'Vérification', num: true, items: [
      { n: '16', t: 'Revérifier tout le système : eau fermée, aucune conduite pleine, valves dans la position d’hiver', crit: true },
      { n: '—', t: 'Photos prises : salle mécanique, valves, bassin vide, buses remisées' },
      { n: '—', t: PISCINE[5].items[6].t }] },
    { id: 'mat', titre: 'Matériel et pièces', col: 'Matériel', col2: 'Pièces de rechange', commun: true, items: [
      { t: 'Compresseur, boyaux et raccords de soufflage' }, { t: 'Pompe à puisard et boyau' }, { t: 'Antigel biodégradable' }, { t: 'Pinces et tournevis divers' }, { t: 'Téflon' },
      { t: 'Bouchons de sorties de buses', g: 2 }, { t: 'Joints de buses et de luminaires', g: 2 }] },
    { id: 'form', titre: 'Formation des employés', col: 'Sujet de formation', commun: true, items: [
      { t: 'Séquence complète de l’hivernement de la fontaine (phases 1 à 5)' },
      { t: 'Démontage, nettoyage et remisage des buses et de la pompe' },
      { t: 'Soufflage sécuritaire à l’air comprimé (pression, protection des yeux et des oreilles)' },
      { t: PISCINE[7].items[6].t }] }
  ];
  /* types : codes de types_bassin et valeurs de bassin.type qui prennent ce gabarit par défaut */
  var GABARITS = [
    { code: 'piscine', nom: 'Piscine', types: ['piscine', 'RE', 'ME', 'PA', 'GEN'], sections: PISCINE, conseils: TIPS, alerte: ALERTE, ordre: 1 },
    { code: 'jeuxdeau', nom: 'Jeux d’eau', types: ['jeuxdeau', 'JE'], sections: JEUXDEAU, ordre: 2, alerte: ALERTE,
      conseils: ['Une ligne de jeu qui garde de l’eau peut éclater au premier gel : on souffle jusqu’à ce qu’il ne sorte plus que de l’air, une ligne à la fois.'] },
    { code: 'fontaine', nom: 'Fontaine', types: ['fontaine', 'FO'], sections: FONTAINE, ordre: 3, alerte: ALERTE,
      conseils: ['Les buses, la pompe submersible et les luminaires se remisent selon les directives de leur fabricant : vérifier la fiche de la fontaine.'] }
  ];
  function copie(x) { return JSON.parse(JSON.stringify(x)); }
  /* Gabarits en service : table gabarits_hivernage si elle est remplie, sinon ceux ci-dessus */
  function gabarits(rows) {
    var g = (rows || []).filter(function (r) { return r && r.actif !== false && Array.isArray(r.sections) && r.sections.length; });
    return (g.length ? g : GABARITS).slice().sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
  }
  /* Gabarit d’un ouvrage (bassin de sites.bassins) : choix de la fiche (hiv.gabarit), sinon son type, sinon son nom */
  function gabaritDe(b, liste) {
    liste = gabarits(liste); b = b || {};
    var cfg = b.hiv || {}, par = function (c) { return liste.filter(function (g) { return g.code === c; })[0] || null; };
    if (cfg.gabarit === 'aucun') return null;
    if (cfg.gabarit && par(cfg.gabarit)) return par(cfg.gabarit);
    /* type de relevé propre au bassin, puis sa nature (piscine, jeux d’eau, fontaine…), puis son nom, puis le type de relevé du site */
    var de = function (t) { return t ? liste.filter(function (g) { return (g.types || []).indexOf(t) >= 0; })[0] || null : null; }, nom = String(b.nom || '');
    return de(b.type_code) || (b.type !== 'autre' && de(b.type)) || (/fontaine/i.test(nom) && par('fontaine')) || (/jeux? d.?eaux?/i.test(nom) && par('jeuxdeau'))
      || de(b.code) || par('piscine') || liste[0] || null;
  }
  /* Liste de contrôle d’un site : sections communes fusionnées (une fois), puis les phases de chaque ouvrage.
     Un seul ouvrage : clés « p1-0 » comme avant ; plusieurs : « <id ouvrage>:p1-0 ». Retraits (hiv.exclus) et ajouts (hiv.ajouts) de la fiche de l’ouvrage. */
  /* Ajustements d’un site (table ouvrage_ajustements, faits sur le terrain ou au bureau) appliqués à ses bassins :
     hiv.exclus / insp.exclus (réf. retirées) et hiv.ajouts (étapes ajoutées). bassin_id vide = tout le site. */
  var LIBRE = 'libre:';
  function estLibre(r) { return String(r && r.section || '').indexOf(LIBRE) === 0; }
  /* Sections libres d’un site : une ligne d’ouvrage_ajustements par étape (domaine hiv, action ajouter, section « libre:Titre ») */
  function sectionsLibres(adj) {
    var out = [];
    (adj || []).filter(function (r) { return r && r.actif !== false && r.domaine === 'hiv' && r.action === 'ajouter' && estLibre(r) && String(r.texte || '').trim(); })
      .sort(function (a, b) { return String(a.cree_le || '').localeCompare(String(b.cree_le || '')); })
      .forEach(function (r) {
        var titre = String(r.section).slice(LIBRE.length).trim() || 'Travaux propres au site', s = out.filter(function (x) { return x.titre === titre; })[0];
        if (!s) { s = { titre: titre, cle: titre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site', items: [] }; out.push(s); }
        s.items.push({ id: r.id, t: String(r.texte).trim(), crit: !!r.crit });
      });
    return out;
  }
  function avecAjustements(bassins, adj) {
    var act = (adj || []).filter(function (r) { return r && r.actif !== false; });
    return (bassins || []).map(function (b, i) {
      var id = String(b.id || 'b' + i), mine = act.filter(function (r) { return !r.bassin_id || String(r.bassin_id) === id; });
      var ex = function (dom) { return mine.filter(function (r) { return r.domaine === dom && r.action === 'exclure'; }).map(function (r) { return r.ref; }); };
      return Object.assign({}, b, { id: id,
        hiv: Object.assign({}, b.hiv, { exclus: ex('hiv'), ajouts: mine.filter(function (r) { return r.domaine === 'hiv' && r.action === 'ajouter' && r.bassin_id && !estLibre(r); })
          .map(function (r) { return { id: r.id, t: r.texte, section: r.section, crit: !!r.crit }; }) }),
        insp: Object.assign({}, b.insp, { exclus: ex('insp') }) });
    });
  }
  /* Liste de contrôle d’un site : sections communes fusionnées (une fois), puis les phases de chaque ouvrage.
     Un seul ouvrage : clés « p1-0 » comme avant ; plusieurs : « <id ouvrage>:p1-0 ». Chaque case garde sa référence de gabarit
     (gref « jeuxdeau:p1-0 », celle des retraits) et son ouvrage (ob ; vide pour une section commune au site). */
  /* Identifiant d’une case dans son gabarit : `id` (posé par l’éditeur de sa-admin, stable quand on déplace ou supprime une étape),
     sinon sa position — les deux sont identiques pour les gabarits d’origine, donc les retraits et rapports existants restent valides. */
  function iid(it, j) { return it && it.id != null && it.id !== '' ? String(it.id) : String(j); }
  /* Étape à choix multiple : `choix` = au moins deux réponses ; la réponse choisie est gardée dans d.c[k] (texte) au lieu de true */
  function choixDe(it) { return it && Array.isArray(it.choix) && it.choix.length > 1 ? it.choix : null; }
  function reponse(d, it) { var v = d && d.c ? d.c[it.k] : null; return typeof v === 'string' ? v : ''; }
  function planSite(bassins, rows, libres) {
    var liste = gabarits(rows), ouv = [];
    (bassins || []).forEach(function (b, i) { if (!b || !String(b.nom || '').trim()) return; var g = gabaritDe(b, liste); if (g) ouv.push({ id: String(b.id || 'b' + i), nom: String(b.nom).trim(), g: g, cfg: b.hiv || {} }); });
    if (!(bassins || []).length) ouv.push({ id: '', nom: '', g: gabaritDe({}, liste), cfg: {} });
    var multi = ouv.length > 1, tete = [], corps = [], fin = [], conseils = [], alerte = '', premier = {};
    var exclu = function (o, gref) { return (o.cfg.exclus || []).indexOf(gref) >= 0; };
    var fusion = function (dest, s, o) {
      var cur = dest.filter(function (x) { return x.id === s.id; })[0];
      if (!cur) { cur = { id: s.id, titre: s.titre, col: s.col, col2: s.col2, num: s.num, commun: true, ob: '', items: [] }; if (s.types && s.types.length) cur.types = s.types.slice(); dest.push(cur); }
      s.items.forEach(function (it, j) {
        var ref = s.id + '-' + iid(it, j), gref = o.g.code + ':' + ref, k = (premier[s.id] !== o.g.code ? o.g.code + ':' : '') + ref, ex = exclu(o, gref);
        var deja = cur.items.filter(function (x) { return x.t === it.t && !!x.b === !!it.b; })[0];
        if (deja) { if (!ex) deja._garde = true; if (deja.grefs.indexOf(gref) < 0) deja.grefs.push(gref); return; }
        cur.items.push(Object.assign(copie(it), { k: k, ref: ref, gref: gref, grefs: [gref], ob: '', _garde: !ex }));
      });
    };
    ouv.forEach(function (o) {
      var secs = o.g.sections || [], pre = multi ? o.id + ':' : '', suf = multi ? ' — ' + o.nom : '';
      var iCorps = secs.map(function (s) { return !s.commun; }).indexOf(true);
      secs.forEach(function (s, si) {
        if (s.commun) { if (!premier[s.id]) premier[s.id] = o.g.code; fusion(iCorps < 0 || si < iCorps ? tete : fin, s, o); return; }
        var its = [];
        s.items.forEach(function (it, j) { var ref = s.id + '-' + iid(it, j), gref = o.g.code + ':' + ref; if (!exclu(o, gref)) its.push(Object.assign(copie(it), { k: pre + ref, ref: ref, gref: gref, ob: o.id }, multi ? { o: o.nom } : {})); });
        corps.push(Object.assign({ id: pre + s.id, sid: s.id, titre: s.titre + suf, col: s.col, col2: s.col2, num: s.num, ob: o.id, items: its }, s.types && s.types.length ? { types: s.types.slice() } : {}));
      });
      (o.cfg.ajouts || []).forEach(function (a) {
        if (!a || !String(a.t || '').trim()) return;
        var cible = corps.filter(function (x) { return x.ob === o.id && x.sid === a.section; })[0] || corps.filter(function (x) { return x.ob === o.id; }).slice(-1)[0];
        var it = Object.assign({ n: '—', t: String(a.t).trim(), crit: !!a.crit, k: pre + 'aj-' + a.id, ref: 'aj-' + a.id, aj: a.id, ob: o.id }, multi ? { o: o.nom } : {});
        if (cible) cible.items.push(it); else corps.push({ id: pre + 'aj', sid: 'aj', titre: 'Étapes propres au site' + suf, col: 'Tâche', num: true, ob: o.id, items: [it] });
      });
      (o.g.conseils || []).forEach(function (t) { if (conseils.indexOf(t) < 0) conseils.push(t); });
      if (!alerte && o.g.alerte) alerte = o.g.alerte;
    });
    /* Sections propres au site (ouvrage_ajustements section « libre:Titre ») : après les phases, avant le matériel et la formation */
    (libres || []).forEach(function (l) {
      corps.push({ id: 'lib-' + l.cle, sid: 'libre', libre: l.titre, titre: l.titre, col: 'Tâche', ob: '', items: l.items.map(function (a) { return { t: a.t, crit: !!a.crit, k: 'lib-' + a.id, ref: 'lib-' + a.id, aj: a.id, ob: '' }; }) });
    });
    var secs = tete.concat(corps, fin).map(function (s) { s.items = s.items.filter(function (it) { var g = it._garde !== false; delete it._garde; return g; }); return s; })
      .filter(function (s) { return s.items.length; });
    var dernier = corps.filter(function (s) { return s.items.length; }).slice(-1)[0];
    secs.forEach(function (s, i) { s.no = i + 2; s.tips = !!dernier && s.id === dernier.id; });
    return { v: 1, ouvrages: ouv.filter(function (o) { return o.id; }).map(function (o) { return { id: o.id, nom: o.nom, gabarit: o.g.code }; }), sections: secs, conseils: conseils, alerte: alerte };
  }
  /* Libellé d’une case retirée (gref « jeuxdeau:p1-0 »), pour la liste « Retirées pour ce site » */
  function libelleRef(gref, rows) {
    var p = String(gref || '').split(':'), g = gabarits(rows).filter(function (x) { return x.code === p[0]; })[0], m = /^(.*)-([^-]+)$/.exec(p[1] || '');
    var s = g && m && (g.sections || []).filter(function (x) { return x.id === m[1]; })[0], it = s && s.items.filter(function (x, j) { return iid(x, j) === m[2]; })[0];
    return it ? (it.n && it.n !== '—' ? it.n + '. ' : '') + it.t + (it.b ? ' ' + it.b : '') : String(gref || '');
  }
  /* Édition d’un gabarit dans sa-admin, en texte : « ## Titre [commun] », puis une ligne par case :
     « 12. Étape », « — Étape » (sans numéro), « - Vérification », « * Pièce de rechange ». « **texte** » = en gras ; « ! » à la fin = étape critique. */
  function versTexte(secs) {
    return (secs || []).map(function (s) {
      return '## ' + s.titre + (s.commun ? ' [commun]' : '') + (s.types && s.types.length ? ' [types: ' + s.types.join(', ') + ']' : '') + '\n' + s.items.map(function (it) {
        var p = it.g === 2 ? '* ' : it.n === '—' ? '— ' : it.n ? it.n + '. ' : '- ';
        return p + it.t + (it.b ? ' **' + it.b + '**' : '') + (it.crit ? ' !' : '');
      }).join('\n');
    }).join('\n\n');
  }
  function deTexte(txt, ancien) {
    var secs = [], cur = null, vus = {};
    var idDe = function (titre) {
      var a = (ancien || []).filter(function (s) { return s.titre === titre; })[0], id = a ? a.id : /formation/i.test(titre) ? 'form' : /mat[ée]riel/i.test(titre) ? 'mat' : /s[ée]curit[ée]/i.test(titre) ? 'secu' : '';
      if (!id || vus[id]) { var n = 1; while (vus['s' + n]) n++; id = 's' + n; }
      vus[id] = 1; return id;
    };
    String(txt || '').split(/\r?\n/).forEach(function (l) {
      l = l.trim(); if (!l) return;
      var h = /^#+\s*(.+)$/.exec(l);
      if (h) {
        var tt = h[1], com = false, ty = null, m2;
        while ((m2 = /\s*\[(commun|types?\s*:\s*([^\]]*))\]\s*$/i.exec(tt))) {
          if (/^commun$/i.test(m2[1])) com = true; else ty = String(m2[2] || '').split(/[,\s]+/).map(function (x) { return x.trim().toLowerCase(); }).filter(Boolean);
          tt = tt.slice(0, m2.index).trim();
        }
        cur = { id: idDe(tt), titre: tt, commun: com, items: [] }; if (ty && ty.length) cur.types = ty; secs.push(cur); return;
      }
      if (!cur) { cur = { id: idDe('Étapes'), titre: 'Étapes', items: [] }; secs.push(cur); }
      var it = {}, m;
      if ((m = /^(\d+)[.)]\s+(.*)$/.exec(l))) { it.n = m[1]; l = m[2]; }
      else if ((m = /^—\s*(.*)$/.exec(l))) { it.n = '—'; l = m[1]; }
      else if ((m = /^\*\s+(.*)$/.exec(l))) { it.g = 2; l = m[1]; }
      else if ((m = /^[-•]\s*(.*)$/.exec(l))) l = m[1];
      if (/\s!$/.test(l) || l === '!') { it.crit = true; l = l.replace(/\s*!$/, ''); }
      if ((m = /^(.*?)\s*\*\*(.+)\*\*$/.exec(l))) { l = m[1]; it.b = m[2]; }
      it.t = l.trim(); if (it.t) cur.items.push(it);
    });
    return secs.filter(function (s) { return s.items.length; }).map(function (s) {
      var num = s.items.some(function (it) { return it.n; }), deux = s.items.some(function (it) { return it.g === 2; });
      var a = (ancien || []).filter(function (x) { return x.id === s.id; })[0], o = { id: s.id, titre: s.titre };
      o.col = a && a.col ? a.col : s.id === 'form' ? 'Sujet de formation' : deux ? 'Matériel' : num ? 'Tâche' : 'Vérification';
      if (deux) o.col2 = a && a.col2 ? a.col2 : 'Pièces de rechange';
      if (num) o.num = true; if (s.commun) o.commun = true; if (s.types) o.types = s.types;
      o.items = s.items.map(function (it) { var x = {}; ['n', 't', 'b', 'crit', 'g', 'court'].forEach(function (k) { if (it[k] != null) x[k] = it[k]; }); return x; });
      return o;
    });
  }
  /* Site sans bassin déclaré : un seul ouvrage, du type de relevé du site */
  function planPourSite(site, rows, adj) {
    site = site || {};
    var bs = (site.bassins || []).filter(function (b) { return b && String(b.nom || '').trim(); });
    return planSite(avecAjustements(bs.length ? bs : [{ id: '', nom: site.nom || 'Site', type_code: site.type || '' }], adj), rows, sectionsLibres(adj));
  }
  /* Plan par défaut (anciens rapports et brouillons sans plan) : la piscine, telle que le formulaire papier */
  var DEFAUT = planSite([], GABARITS);
  var SECTIONS = DEFAUT.sections;
  function planDe(d) { return d && d.plan && Array.isArray(d.plan.sections) ? d.plan : DEFAUT; }
  /* Type d’hivernement : choisi à la création, il donne le titre du rapport et les sections retenues.
     formation = la section « Formation des employés » est faite ; une section de gabarit marquée [types: …] ne sert qu’à ces types. */
  var TYPES = [
    { code: 'formation', nom: 'Fermeture avec formation', formation: true },
    { code: 'complete', nom: 'Fermeture complète', formation: false },
    { code: 'dormance', nom: 'Mise en dormance (fermeture partielle)', formation: false },
    { code: 'remise', nom: 'Remise en service (ouverture)', formation: false },
    { code: 'autre', nom: 'Autre (préciser)', formation: true }
  ];
  function typeDe(d) {
    var c = d && d.type, t = TYPES.filter(function (x) { return x.code === c; })[0] || TYPES[0];
    var nom = t.code === 'autre' ? String(d.type_nom || '').trim() || 'Intervention' : t.nom;
    return { code: t.code, nom: nom, formation: d && typeof d.formation === 'boolean' ? d.formation : t.formation };
  }
  /* Sections faites pour ce type, numérotées pour l’affichage (le plan figé du brouillon reste entier) */
  function sectionsDe(d) {
    var t = typeDe(d), P = planDe(d), garde = P.sections.filter(function (s) {
      if ((s.sid || s.id) === 'form' && !t.formation) return false;
      return !(s.types && s.types.length) || s.types.indexOf(t.code) >= 0;
    });
    var aConseil = garde.some(function (s) { return s.tips; }), dernier = garde.filter(function (s) { return !s.commun; }).slice(-1)[0];
    return garde.map(function (s, i) { return Object.assign({}, s, { no: i + 2, tips: aConseil ? !!s.tips : !!dernier && s === dernier }); });
  }
  function travauxDe(d) { return (d.travaux || []).filter(function (x) { return String(x.t || '').trim(); }); }
  function materielDe(d) { return (d.materiel || []).filter(function (x) { return String(x.nom || '').trim(); }); }
  /* Numéros des sections qui suivent la liste : travaux sur mesure et matériel (s’il y en a), remarques, validation */
  function numeros(d) {
    var n = sectionsDe(d).length + 2, o = {};
    if (travauxDe(d).length) o.travaux = n++;
    if (materielDe(d).length) o.materiel = n++;
    o.remarques = n++; o.validation = n; return o;
  }
  /* Suggestions pour « Matériel et produits utilisés » : la section Matériel du plan, puis les produits courants */
  var PRODUITS = ['Antigel biodégradable', 'Chlore granulaire', 'Produit d’hivernage (algicide d’hiver)', 'Liquide de remisage des sondes', 'Téflon', 'Bouchons d’hivernage'];
  function matSugg(d) {
    var out = [];
    planDe(d).sections.forEach(function (s) { if ((s.sid || s.id) === 'mat') s.items.forEach(function (it) { out.push(it.t); }); });
    PRODUITS.forEach(function (t) { out.push(t); });
    return out.filter(function (t, i) { return out.indexOf(t) === i; });
  }
  function qteTxt(m) { return (m.qte !== '' && m.qte != null ? m.qte + (m.unite ? ' ' + m.unite : '') : '') ; }

  function blank(o) {
    o = o || {};
    return { v: 1, info: { date: o.date || '', site: o.site || '', heure_debut: '', heure_fin: '', chef: o.chef || '', temperature: '', equipe: '', bassins: '' },
      type: o.type || 'formation', type_nom: o.type_nom || '', travaux: [], materiel: [],
      c: {}, employes: [], remarques: '', responsable: o.responsable == null ? 'Maxime' : o.responsable, courriel: o.courriel || '', envois: [], plan: o.plan || null };
  }
  function norm(d) {
    var b = blank(); d = d || {};
    var o = { v: 1, info: Object.assign(b.info, d.info || {}), type: d.type || 'formation', type_nom: d.type_nom || '',
      travaux: (d.travaux || []).map(function (x) { return { t: x.t || '', fait: !!x.fait, note: x.note || '', duree: x.duree == null ? '' : String(x.duree) }; }),
      materiel: (d.materiel || []).map(function (x) { return { nom: x.nom || '', qte: x.qte == null ? '' : String(x.qte), unite: x.unite || '' }; }),
      c: Object.assign({}, d.c || {}), employes: (d.employes || []).map(function (e) { return { nom: e.nom || '', formation: !!e.formation, demo: !!e.demo }; }),
      remarques: d.remarques || '', responsable: d.responsable == null ? b.responsable : d.responsable, courriel: d.courriel || '', envois: (d.envois || []).slice(), plan: d.plan && Array.isArray(d.plan.sections) ? d.plan : null };
    if (typeof d.formation === 'boolean') o.formation = d.formation;
    return o;
  }
  /* Un rapport d'hivernage est-il une liste de contrôle « Hivernement » ? */
  function isChecklist(r) { return !!(r && Array.isArray(r.sections) && r.sections[0] && r.sections[0].hivernement); }
  function fromReport(r) { return isChecklist(r) ? norm(r.sections[0].hivernement) : null; }
  function photosOf(r) { return isChecklist(r) ? (r.sections[0].photos || []) : []; }

  /* Avancement : toutes les cases, comme le formulaire papier (formation des employés nommés comprise) */
  function progress(d) {
    d = norm(d); var total = 0, done = 0;
    sectionsDe(d).forEach(function (s) { s.items.forEach(function (it) { total++; if (d.c[it.k]) done++; }); });
    if (typeDe(d).formation) d.employes.forEach(function (e) { if (!String(e.nom).trim()) return; total += 2; if (e.formation) done++; if (e.demo) done++; });
    travauxDe(d).forEach(function (x) { total++; if (x.fait) done++; });
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
  }
  /* Libellé court pour le chantier (sa-terrain, « Texte court ») : `court` du gabarit, sinon le début de l’étape
     jusqu’à la première précision (« (… », « : », « . », « — » ; jamais à une virgule, qui porte souvent l’action), s’il reste assez de texte. Le rapport garde toujours le texte complet. */
  function court(it) {
    if (it && String(it.court || '').trim()) return String(it.court).trim();
    var t = String(it && it.t || ''), m = /\s*(\(|:\s|\.\s|\s—\s|;\s)/.exec(t.slice(15));
    return m ? t.slice(0, 15 + m.index).trim() : t;
  }
  function label(it) { return it.t + (it.b ? ' ' + it.b : ''); }
  function labelRep(d, it) { var r = reponse(d, it); return label(it) + (r ? ' : ' + r : ''); }
  function manquants(d) {
    d = norm(d); var out = [];
    sectionsDe(d).forEach(function (s) { if (s.id === 'mat') return; s.items.forEach(function (it) { if (!d.c[it.k]) out.push((it.n && it.n !== '—' ? it.n + '. ' : '') + label(it)); }); });
    travauxDe(d).forEach(function (x) { if (!x.fait) out.push('Travaux : ' + x.t); });
    return out;
  }
  function critiquesManquants(d) {
    d = norm(d); var out = [];
    sectionsDe(d).forEach(function (s) { s.items.forEach(function (it) { if (it.crit && !d.c[it.k]) out.push((it.o ? it.o + ' ' : '') + (it.n && it.n !== '—' ? it.n : '★') + '. ' + label(it)); }); });
    return out;
  }

  /* Ligne de rapports_hivernage (sans id / created_*) à partir de la saisie */
  function toReport(d, base, photos) {
    d = norm(d); var p = progress(d), i = d.info, b = base || {};
    var s0 = { id: 'hivernement', title: 'Liste de contrôle d’hivernement — ' + typeDe(d).nom, tag: critiquesManquants(d).length ? 'urgent' : '',
      items: ['Avancement : ' + p.done + ' / ' + p.total + ' cases (' + p.pct + ' %)'].concat(INFO.filter(function (f) { return i[f[0]]; }).map(function (f) { return f[1] + ' : ' + i[f[0]]; })),
      photos: photos || [], hivernement: d };
    var T = typeDe(d), SD = sectionsDe(d), N = SD.length;
    var secs = [s0].concat(SD.map(function (s) {
      return { id: 'hv-' + s.id, title: s.no + '. ' + s.titre, tag: '', photos: [], items: s.items.map(function (it) { return (d.c[it.k] ? '✔ ' : '☐ ') + (it.n && it.n !== '—' ? it.n + '. ' : '') + labelRep(d, it); }) };
    }));
    var tr = travauxDe(d), mt = materielDe(d);
    if (tr.length) secs.push({ id: 'hv-travaux', title: numeros(d).travaux + '. Travaux sur mesure', tag: '', photos: [], items: tr.map(function (x) { return (x.fait ? '✔ ' : '☐ ') + x.t + (x.duree ? ' (' + x.duree + ' h)' : '') + (x.note ? ' — ' + x.note : ''); }) });
    if (mt.length) secs.push({ id: 'hv-materiel', title: numeros(d).materiel + '. Matériel et produits utilisés', tag: '', photos: [], items: mt.map(function (m) { return m.nom + (qteTxt(m) ? ' : ' + qteTxt(m) : ''); }) });
    var emp = T.formation ? d.employes.filter(function (e) { return String(e.nom).trim(); }) : [];
    if (emp.length) secs.push({ id: 'hv-employes', title: 'Employés formés', tag: '', photos: [], items: emp.map(function (e) { return e.nom + ' — formation ' + (e.formation ? 'complétée' : 'non complétée') + ', démonstration ' + (e.demo ? 'réussie' : 'non réussie'); }) });
    return Object.assign({}, b, { site_id: b.site_id || '', site_nom: i.site || b.site_nom || '', client: b.client || '', objet: TITRE + ' — ' + T.nom.toLowerCase(),
      titre: TITRE + ' — ' + (i.site || b.site_nom || ''), sous_titre: 'Liste de contrôle d’intervention · ' + T.nom, date_rapport: b.date_rapport || i.date || '', date_inspection: i.date || b.date_inspection || '',
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
    d = norm(d); opts = opts || {}; var p = progress(d), i = d.info, E = esc, T = typeDe(d), NO = numeros(d);
    var box = function (on) { return '<span class="box' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span>'; };
    var row = function (it, withNum) { var on = !!d.c[it.k]; return '<tr class="' + (on ? 'done' : '') + (it.crit ? ' critical' : '') + '"><td class="cb">' + box(on) + '</td>' + (withNum ? '<td class="num">' + E(it.n) + '</td>' : '') + '<td class="t">' + E(it.t) + (it.b ? ' <strong>' + E(it.b) + '</strong>' : '') + (choixDe(it) ? ' — <strong>' + (reponse(d, it) ? E(reponse(d, it)) : '____') + '</strong> <span class="choix">(' + E(choixDe(it).join(' / ')) + ')</span>' : '') + '</td></tr>'; };
    var h = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + E(TITRE + ' — ' + (i.site || '')) + '</title><style>' + CSS + '</style></head><body><div class="page">'
      + '<header class="top"><div><h1>' + E(TITRE + ' — ' + (i.site || '')) + '</h1><div class="sub">Liste de contrôle d’intervention · ' + E(T.nom) + '</div></div><img src="' + LOGO + '" alt="Soucy Aquatik"></header><div class="body">'
      + '<div class="kpis"><div class="kpi"><div class="val">' + p.total + '</div><div class="lbl">Cases au total</div></div><div class="kpi"><div class="val">' + p.done + '</div><div class="lbl">Cases cochées</div></div><div class="kpi"><div class="val">' + p.pct + ' %</div><div class="lbl">Avancement</div></div></div>'
      + '<h2>1. Informations générales</h2><div class="info-grid">' + INFO.map(function (f) { return '<div class="field' + (f[3] ? ' wide' : '') + '"><label>' + E(f[1]) + ' :</label><span>' + E(i[f[0]]) + '</span></div>'; }).join('') + '</div>';
    var P = planDe(d);
    sectionsDe(d).forEach(function (s) {
      h += '<h2>' + s.no + '. ' + E(s.titre) + '</h2>';
      if (s.col2) {
        var a = s.items.filter(function (it) { return it.g !== 2; }), b = s.items.filter(function (it) { return it.g === 2; }), n = Math.max(a.length, b.length), r = '';
        for (var j = 0; j < n; j++) r += '<tr>' + [a[j], b[j]].map(function (it) { return it ? '<td class="cb">' + box(!!d.c[it.k]) + '</td><td>' + E(it.t) + '</td>' : '<td class="cb"></td><td></td>'; }).join('') + '</tr>';
        h += '<table><tr><th class="cb">✔</th><th>' + E(s.col) + '</th><th class="cb">✔</th><th>' + E(s.col2) + '</th></tr>' + r + '</table>';
      } else h += '<table><tr><th class="cb">✔</th>' + (s.num ? '<th class="num">#</th>' : '') + '<th>' + E(s.col) + '</th></tr>' + s.items.map(function (it) { return row(it, s.num); }).join('') + '</table>';
      if (s.tips) h += (P.conseils.length ? '<div class="tip"><strong>Bon à savoir :</strong><ul class="clean">' + P.conseils.map(function (t) { return '<li>' + E(t) + '</li>'; }).join('') + '</ul></div>' : '') + (P.alerte ? '<div class="alert">' + E(P.alerte) + '</div>' : '');
      if (s.id === 'form') {
        var emp = d.employes.filter(function (e) { return String(e.nom).trim(); });
        while (emp.length < (opts.blankRows == null ? 2 : opts.blankRows)) emp.push(null);
        h += '<table style="margin-top:12px;"><tr><th>Employé (nom)</th><th style="width:150px;">Formation complétée</th><th style="width:150px;">Démonstration réussie</th></tr>'
          + emp.map(function (e) { return '<tr><td style="height:30px;">' + E(e ? e.nom : '') + '</td><td>' + box(!!(e && e.formation)) + '</td><td>' + box(!!(e && e.demo)) + '</td></tr>'; }).join('') + '</table>';
      }
    });
    var tr = travauxDe(d), mt = materielDe(d);
    if (tr.length) h += '<h2>' + NO.travaux + '. Travaux sur mesure</h2><table><tr><th class="cb">✔</th><th>Travaux</th><th style="width:80px;">Heures</th><th>Note</th></tr>'
      + tr.map(function (x) { return '<tr class="' + (x.fait ? 'done' : '') + '"><td class="cb">' + box(x.fait) + '</td><td class="t">' + E(x.t) + '</td><td>' + E(x.duree) + '</td><td>' + E(x.note) + '</td></tr>'; }).join('') + '</table>';
    if (mt.length) h += '<h2>' + NO.materiel + '. Matériel et produits utilisés</h2><table><tr><th>Matériel ou produit</th><th style="width:160px;">Quantité</th></tr>'
      + mt.map(function (m) { return '<tr><td>' + E(m.nom) + '</td><td>' + E(qteTxt(m)) + '</td></tr>'; }).join('') + '</table>';
    var ph = (opts.photos || []).filter(function (x) { return x && /^data:image|^https?:/.test(x.data || x.url || ''); });
    h += '<h2>' + NO.remarques + '. Remarques et anomalies</h2><table><tr><td class="notes">' + E(d.remarques) + '</td></tr></table>'
      + (ph.length ? '<div class="photos">' + ph.map(function (x) { return '<img src="' + E(x.data || x.url) + '" alt="' + E(x.name || 'Photo') + '">'; }).join('') + '</div>' : '')
      + '<h2>' + NO.validation + '. Validation</h2><div class="sign-row"><div class="sign-box">Chef d’équipe — Signature et date<b>' + E(i.chef) + '</b></div><div class="sign-box">Responsable' + (d.responsable ? ' (' + E(d.responsable) + ')' : '') + ' — Signature et date</div></div>'
      + '<div class="foot">Soucy Aquatik · liste de contrôle générée par SA Platform</div></div></div></body></html>';
    return h;
  }

  /* Corps du courriel au client */
  function texte(d) {
    d = norm(d); var p = progress(d), i = d.info, m = manquants(d);
    var T = typeDe(d), mt = materielDe(d);
    return 'Bonjour,\n\nVoici la liste de contrôle de l’hivernement' + (i.site ? ' de ' + i.site : '') + ' (' + T.nom.toLowerCase() + ')' + (i.date ? ' réalisé le ' + i.date : '') + '.\n\n'
      + 'Avancement : ' + p.done + ' / ' + p.total + ' cases cochées (' + p.pct + ' %).\n'
      + (m.length ? '\nÉtapes non cochées :\n' + m.slice(0, 15).map(function (x) { return '• ' + x; }).join('\n') + (m.length > 15 ? '\n• … et ' + (m.length - 15) + ' autre(s)' : '') + '\n' : '\nToutes les étapes de l’hivernement ont été réalisées.\n')
      + (mt.length ? '\nMatériel et produits utilisés :\n' + mt.map(function (m) { return '• ' + m.nom + (qteTxt(m) ? ' : ' + qteTxt(m) : ''); }).join('\n') + '\n' : '')
      + (d.remarques ? '\nRemarques : ' + d.remarques + '\n' : '')
      + '\nLa liste de contrôle complète est jointe à ce courriel.\n\nSoucy Aquatik';
  }
  function fichier(d) { d = norm(d); return ('Hivernement ' + (d.info.site || '') + ' ' + (d.info.date || '')).trim().replace(/[\\/:*?"<>|\s]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') + '.html'; }

  var api = { SECTIONS: SECTIONS, GABARITS: GABARITS, DEFAUT: DEFAUT, gabarits: gabarits, gabaritDe: gabaritDe, planSite: planSite, planPourSite: planPourSite, avecAjustements: avecAjustements, libelleRef: libelleRef, iid: iid, choixDe: choixDe, reponse: reponse, planDe: planDe, versTexte: versTexte, deTexte: deTexte, INFO: INFO, TYPES: TYPES, typeDe: typeDe, sectionsDe: sectionsDe, sectionsLibres: sectionsLibres, LIBRE: LIBRE, numeros: numeros, travauxDe: travauxDe, materielDe: materielDe, matSugg: matSugg, court: court, TIPS: TIPS, ALERTE: ALERTE, LOGO: LOGO, blank: blank, norm: norm, isChecklist: isChecklist, fromReport: fromReport, photosOf: photosOf,
    progress: progress, manquants: manquants, critiquesManquants: critiquesManquants, toReport: toReport, html: html, texte: texte, fichier: fichier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SAHiv = api;
})(typeof window !== 'undefined' ? window : this);
