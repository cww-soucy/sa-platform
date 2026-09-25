// SA Platform — Service Worker
// v73 — Correctif CRITIQUE lié au groupeId introduit en v72 : la colonne correspondante n'existait pas
// encore côté serveur (Supabase), donc CHAQUE sauvegarde d'un WO multi-jours était rejetée par le serveur
// (colonne inconnue) — d'où l'impression que "ça ne marche plus" et, très probablement, des tentatives
// répétées ayant créé de vrais doublons en production (14 Work Orders + 13 tâches Planning dupliqués pour
// "Complexe Locatif Cobalt", créés à 11 minutes d'intervalle). Colonne ajoutée en base, mapping
// camelCase↔snake_case complété (groupeId ↔ groupe_id, dans les deux sens), et les 27 doublons confirmés
// ont été supprimés directement en base (toujours la copie la plus ancienne conservée). Aucun autre client
// touché — vérifié qu'aucun autre doublon n'existe dans workorders ni planning_tasks. Aucune autre fonction
// touchée.
// v72 — Correctif important : créer un WO sur plusieurs jours (plage, jours choisis, ou récurrence "tous
// les jeudis") créait bien plusieurs Work Orders indépendants comme prévu, mais la LISTE DES WO les
// affichait chacun comme une carte séparée — au lieu d'un seul dossier client comme Charles s'y attendait.
// Corrigé sans changer la base de données : les WO créés ensemble partagent maintenant un groupeId, et la
// liste les affiche regroupés sous UNE SEULE carte "dossier" (client, site, nombre de visites, progression
// globale), avec la liste des dates en dessous — chaque visite reste cliquable individuellement pour voir
// ou modifier SON statut et SES tâches, qui restent distincts par visite. L'édition d'une visite existante
// préserve maintenant son groupeId (avant, il aurait été perdu à la sauvegarde). Testé sur les vraies
// données du fichier : 58 WO en base, 1 groupe de 5 visites → 54 cartes affichées, comme attendu. Aucune
// autre fonction touchée.
// v71 — Le tableau "Charge de la semaine" (v68) jugé pas clair (juste des chiffres, impossible de voir
// QUELS jobs, ni lesquels sont récurrents) est remplacé par un "Agenda de la semaine" : pour chaque jour,
// la liste des jobs avec leur nom, le technicien assigné, le statut, et un badge 🔁 pour les tâches
// récurrentes (détecté automatiquement — même titre + même technicien répété sur plusieurs semaines dans
// le planning, comme une série créée via "Tous les jeudis…", aucun champ à remplir en plus). Le visuel en
// barres et le détail complet (v67) restent en dessous, inchangés. Aucune autre fonction touchée.
// v70 — Correctif : les tâches Planning récurrentes créées SANS site précisé (ex. via le générateur
// "Tous les jeudis" de la v69) étaient invisibles dans le Gantt Jobs — jgBuildGroups exigeait un site pour
// les afficher. Elles apparaissent maintenant aussi, regroupées par technicien assigné plutôt que par site.
// Rappel pour Charles : le vrai calendrier visuel type Gantt (barres proportionnelles, couleurs de statut,
// clic pour ouvrir) est l'écran "Jobs Gantt" dans Centre d'opérations — différent de l'écran "Planning"
// (grille jour par jour). Aucune autre fonction touchée.
// v69 — Ajout au sélecteur de jours (WO / Créneaux / Planning) : en mode "Jours choisis", un générateur
// de récurrence "Tous les [jour de semaine] jusqu'au [date]" (ex. tous les jeudis jusqu'au 15 novembre) —
// remplit automatiquement le calendrier avec les bonnes dates, qui restent ensuite modifiables une par une
// (retirer un jeudi précis en cliquant sa puce, comme n'importe quel autre jour choisi). Réutilise
// entièrement le mode 3 existant (mêmes puces, même calendrier, même logique de sauvegarde un enregistrement
// par jour) — aucune nouvelle table, aucun nouveau mode. Aucune autre fonction touchée.
// v68 — Ajout demandé après la v67 : un tableau "Charge de la semaine" tout en haut de l'impression du
// module Planning, AVANT le visuel en barres. Une grille technicien × jour (lundi à dimanche de la semaine
// en cours), avec le nombre de tâches ce jour-là dans chaque case, colorée par intensité (gris = rien,
// vert = léger, orange = chargé, rouge = très chargé), plus une ligne "Total équipe" par jour et une
// colonne total par personne. Objectif : voir la charge de travail et l'achalandage de la semaine d'un
// seul coup d'œil en réunion, sans avoir à déchiffrer les barres. Le visuel en barres et le détail complet
// (v67) restent en dessous, inchangés. Aucune autre fonction touchée.
// v67 — Correctif important : le bouton "Imprimer" du module PLANNING (celui accessible depuis l'onglet
// Planning, différent du bouton "Imprimer / Envoyer" de Jobs Gantt) n'avait PAS reçu la mise à jour A3 +
// visuel en barres de la v66 — Charles imprime depuis ce bouton-là, pas Jobs Gantt, d'où l'impression de
// "rien n'a changé". Même traitement maintenant appliqué : visuel en barres colorées par technicien/site
// (réutilise le même CSS que Jobs Gantt) suivi du détail complet, imprimé en A3 paysage. Aucune autre
// fonction touchée (vérifié par comparaison automatique avec la v66).
// v66 — Deux gros ajouts, purement additifs, aucune fonction protégée de Temps/Suivi/Cumul touchée :
// (1) Sélecteur de jours multiples sur les trois formulaires de planification (Work Orders, Créneaux,
// Tâches Planning) : 3 modes au choix — un seul jour (comportement d'origine, inchangé), plage
// consécutive (comme Planning le faisait déjà), ou jours choisis non consécutifs (petit calendrier
// cliquable + saisie manuelle de type "28/09, 30/09, 3/10"). Chaque jour choisi crée un enregistrement
// indépendant (même principe que les "copies indépendantes" déjà utilisées pour plusieurs employés sur
// une tâche planning) — aucune structure de données existante modifiée, chaque WO/créneau/tâche reste à
// un seul jour dans la base, modifiable et cochable séparément. En édition, le sélecteur de mode est
// masqué et le comportement reste strictement celui d'avant (un seul enregistrement). Nouveau contrôleur
// JS partagé (dpInit/dpSetMode/dpGetDates/etc.) réutilisé identiquement par les trois formulaires.
// (2) Impression du Gantt Jobs refaite : vrai visuel en barres colorées (comme à l'écran, pas juste un
// tableau texte) suivi du détail complet, imprimé en A3 paysage pour rester lisible en réunion — le reste
// de l'app (Plan de Match, WO, Bon de Livraison, etc.) continue d'imprimer en A4 portrait par défaut
// (nouveau mécanisme setPrintPageSize, actif seulement pour ce bouton précis, réinitialisé automatiquement
// après impression). Vérifié par comparaison automatique de fonctions avec la v65 : seules les fonctions
// listées ci-dessus ont changé, aucune autre.
// v65 — Deux ajouts, purement additifs, aucune fonction protégée de Temps/Suivi/Cumul touchée :
// (1) Bon de Livraison : le logo Soucy Aquatik (carré bleu) est maintenant affiché dans l'en-tête du
// document imprimable, à côté du mot-clé "SOUCY AQUATIK" — avant, seul le texte était présent, sans
// image. Réutilise une image déjà encodée en base64, ajoutée uniquement dans livraisonBuildPrintHTML().
// (2) Nouveau module "🗳️ Sondages clients" dans Stats, visible uniquement superviseur/admin (isSup()) :
// liste des sondages de satisfaction envoyés aux clients (ex. formation hivernement), tableau de bord
// (qualité, clarté, score de recommandation, sujets couverts, besoins) lu depuis les tables Supabase
// `sondages`/`sondage_reponses` via le client sb déjà en place, et un bouton "+ Nouveau sondage" qui
// réutilise le gabarit existant pour un nouveau client/site (insertion dans `sondages`, lien généré
// immédiatement). Vérifié par comparaison automatique de fonctions avec la v64 : seules les fonctions
// listées ci-dessus ont changé, aucune autre.
// (v64 — Correctif majeur sur les feuilles de temps : les corrections faites à la main ne sont plus
// défaites par la synchronisation. Avant, la fusion local/serveur était une simple union sans savoir
// quel côté était le plus récent : un punch supprimé revenait, une heure corrigée à la baisse était
// annulée par l'ancienne valeur, et changer l'heure de début ou le lieu créait un doublon. Chaque
// punch corrigé porte maintenant une identité stable et l'heure de sa dernière modification — la
// version la plus récente gagne — et une suppression laisse une trace qui voyage avec la semaine,
// donc le punch ne peut plus ressusciter. De plus, l'écran Temps ne se recharge plus par-dessus une
// correction en cours : la sauvegarde renvoyait un événement temps réel qui réaffichait l'ancienne
// version. Aucun calcul d'heures modifié.
// (v63 — Correctif : le fichier Excel de la paie ne sortait pas sur iPhone/iPad. La librairie de mise en
// forme se charge à la demande, et le téléchargement partait donc APRÈS la fin du geste de l'utilisateur —
// Safari le bloque alors sans rien afficher. La librairie est maintenant préchargée dès l'ouverture de
// l'écran de sortie, et le fichier produit reste affiché à l'écran avec un bouton « ⬇️ Ouvrir /
// télécharger » (plus « 📤 Partager » sur téléphone) qui, lui, ne peut pas être bloqué. Toute erreur de
// génération affiche désormais un message au lieu d'échouer en silence. Rien d'autre n'a changé.)
// (v62 — Correctif : un compte supprimé réapparaissait à la synchronisation suivante. La suppression
// n'effaçait que la copie locale ; la ligne restait dans Supabase et le prochain pull la ramenait.
// La suppression efface maintenant AUSSI la ligne serveur (et la journalise pour la Loi 25). Le même
// défaut existait sur la suppression d'un véhicule et d'un article d'inventaire : corrigé aux trois
// endroits. Rien d'autre n'a changé.)
// (v61 — Photos et repérage physique, d'après les maquettes validées. Sur la fiche d'un outil : des photos
// prises directement avec l'appareil photo de l'iPhone/iPad (même composant que les photos de punch), et
// un emplacement où il est rangé. Nouveau sous-onglet « 📍 Emplacements » dans Logistique : l'entrepôt et
// le bureau en arborescence Bâtiment → Zone → Étagère, avec sous chaque étagère ce qui devrait s'y
// trouver et un badge quand un outil en est sorti. Chaque étagère a son étiquette QR (EMP-…) imprimable
// en 3×3 cm : la scanner ouvre directement le contenu attendu de cette étagère, ce qui rend l'inventaire
// rapide. Les zones et étagères s'éditent dans ⚙️ Config, comme les catégories et les préfixes. La
// première photo d'un outil sert de vignette dans la liste. Aucune fonction de calcul Temps/Suivi/Cumul
// touchée.)
// (v60 — Nouveau module « Outils / QR », intégré dans l'onglet Logistique (sous-onglets 🔧 Outils et
// ⚙️ Config, ce dernier réservé au superviseur/admin) — aucune nouvelle entrée dans la barre de
// navigation. Catalogue d'outils avec repérage unique auto-incrémenté (PER-0001…) et étiquette QR
// imprimable 3×3 cm (correction d'erreur L pour rester lisible à cette taille), format de payload
// SOUCY-DPTM:{repérage}|{nom & marque}. Prise et retour d'un outil par scan ou depuis la liste, TOUJOURS
// rattachés au punch actif de l'employé : sans punch en cours, la prise est refusée avec un message
// clair. Un outil déjà sorti par quelqu'un d'autre est bloqué net (le superviseur peut forcer le retour,
// la raison est journalisée). Chaque mouvement est enregistré avec l'employé, l'heure, le punch, le site
// et le WO. En Sortie d'Inventaire, un bouton « Scanner un produit » ajoute automatiquement chaque
// produit scanné comme ligne, avec un bandeau rappelant le site et le WO du punch en cours. Catégories,
// préfixes de repérage et préfixe QR sont éditables dans Config. Trois nouvelles tables serveur (outils,
// outils_mouvements, logistique_config) synchronisées comme les autres, fonctionnement hors-ligne par
// localStorage. Aucune fonction de calcul Temps/Suivi/Cumul modifiée : seuls quatre points d'ancrage
// existants ont été touchés (switchMod, openSortieModal, et les deux chemins de connexion).)
// (v59 — Mise en page des fichiers Excel refaite d'après les maquettes validées avant codage. …)
// (v58 … v49 — voir historique précédent, inchangé.)

var CACHE_NAME = 'sa-platform-v75';

// Installation : s'activer tout de suite sans attendre
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Activation : prendre le contrôle immédiatement + purger les vieux caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n){ return n !== CACHE_NAME; })
             .map(function(n){ return caches.delete(n); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

// Réseau d'abord pour le HTML (évite d'afficher une vieille version en cache),
// cache en secours si hors-ligne.
self.addEventListener('fetch', function(event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate' || (req.headers.get('accept')||'').indexOf('text/html') >= 0) {
    event.respondWith(
      fetch(req).catch(function(){ return caches.match(req).then(function(r){ return r || caches.match('/'); }); })
    );
    return;
  }
});

// Push DÉSACTIVÉ : aucune notification.
self.addEventListener('push', function(event) { return; });

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list) {
      for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
