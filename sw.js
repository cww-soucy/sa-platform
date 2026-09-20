// SA Platform — Service Worker
// v63 — Correctif : le fichier Excel de la paie ne sortait pas sur iPhone/iPad. La librairie de mise en
// forme se charge à la demande, et le téléchargement partait donc APRÈS la fin du geste de l'utilisateur —
// Safari le bloque alors sans rien afficher. La librairie est maintenant préchargée dès l'ouverture de
// l'écran de sortie, et le fichier produit reste affiché à l'écran avec un bouton « ⬇️ Ouvrir /
// télécharger » (plus « 📤 Partager » sur téléphone) qui, lui, ne peut pas être bloqué. Toute erreur de
// génération affiche désormais un message au lieu d'échouer en silence. Rien d'autre n'a changé.
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
// (v59 — Mise en page des fichiers Excel refaite d'après les maquettes validées avant codage.
// « Sommaire paie » : bandeau de titre, trois indicateurs en haut (total équipe, heures supplémentaires,
// ce qui reste à vérifier), puis six colonnes seulement — la colonne TOTAL, sur fond bleu, est le seul
// chiffre que la paie recopie. Une fiche par employé (onglet à son nom) : bandeau avec son total, les
// journées avec sous-total, le total par job pour la facturation, le bloc régulier/supplémentaire/total
// à payer et les lignes de signature — elle s'imprime et se signe telle quelle, et c'est exactement ce
// que l'employé reçoit. S'ajoute un onglet « Toute l'équipe » : un bandeau par employé, tout se lit en
// descendant, pour la paie qui préfère une seule liste. Les deux lectures sont dans le même classeur.
// Les lignes en attente de validation sont sur fond ambre, les heures restent en décimal dans les
// cellules de calcul et à la française (80,52 h) dans les textes affichés.)
// (v58 — Quatre corrections sur le module « Feuilles de temps équipe » livré en v57 :
// (1) COURRIEL SANS OUTLOOK : les boutons passaient par le lien web Outlook (outlook.office.com), qui
// exige d'être connecté à Outlook Web — donc rien ne s'ouvrait. Le module n'utilise plus aucune API ni
// aucun service de courriel : il ouvre le logiciel de courriel DÉJÀ installé (mailto: → Outlook de
// bureau, Mail sur iPhone) avec le message déjà écrit, et sur téléphone/tablette il propose le partage
// natif du fichier (Mail, Teams, Messages…). Le détail part en pièce jointe : le fichier Excel est
// téléchargé juste avant, il ne reste qu'à le glisser dans le message.
// (2) PUNCHS REGROUPÉS : plusieurs punchs de la MÊME journée sur le MÊME job (même site + même ODT)
// étaient listés un par un — un aller-retour de 1 minute créait une ligne complète. Ils sont maintenant
// regroupés en UNE ligne de feuille de temps (heures additionnées, de la première arrivée au dernier
// départ, avec le nombre de punchs d'origine indiqué « ×3 punchs »). Les heures sont strictement les
// mêmes : c'est la présentation qui change, pas le calcul. Une bascule « 📋 Feuille de temps / 🧾 Journal
// des punchs » sépare clairement les deux lectures : la feuille (regroupée) sert à la paie et à
// l'impression ; le journal (brut, punch par punch) sert à vérifier, corriger et à l'audit. Les lignes
// de moins de 6 minutes sont signalées « très court » pour être vérifiées plutôt que payées à l'aveugle.
// (3) FICHIERS EXCEL REFAITS : l'export était illisible et trop condensé. Nouveau classeur, une seule
// pièce jointe pour toute l'équipe, avec 5 feuilles séparées et mises en forme (en-têtes de couleur
// Soucy, colonnes à la bonne largeur, volets figés, filtres, totaux en gras, heures en décimal pour le
// calcul ET en h:mm pour la lecture) : « Sommaire paie » (une ligne par employé : jours, jobs, régulier,
// supplémentaire, total, colonne « à vérifier »), « Par employé » (la feuille telle qu'on la lit, blocs
// par jour avec sous-totaux), « Détail (données) » (tableau plat filtrable/triable), « Total par job »
// (facturation) et « Journal des punchs » (audit). La mise en forme est produite par xlsx-js-style,
// chargé À LA DEMANDE au premier export seulement (aucun ralentissement à l'ouverture) ; si le CDN ne
// répond pas, le même fichier sort avec la librairie déjà présente, sans les couleurs.
// (4) TRAVAIL DE LA PAIE : au lieu de lire et recopier chaque feuille une par une, le technicien de paie
// reçoit UN fichier dont la première feuille est le sommaire à recopier, avec le total équipe déjà fait
// et les cas douteux signalés. L'écran de sortie est réorganisé en deux étapes : « 1 · Fichier pour la
// paie » (avec l'adresse courriel de la paie, retenue d'une fois à l'autre) puis « 2 · Copie à chaque
// employé ».)
// (v57 — Nouveau module « Feuilles de temps équipe » (demande : plus besoin d'attendre que chaque employé
// pense à faire « envoyer » — le superviseur sort lui-même toutes les feuilles de la semaine d'un seul
// écran). Accessible depuis le Poste de commande (bouton principal) et depuis « Heures équipe ». L'écran
// regroupe les employés AYANT punché dans la semaine et, pour chacun : le détail complet de ses punchs
// avec PLUSIEURS PUNCHS PAR JOUR (chacun sur son site/ODT, avec sa plage horaire), le total de CHAQUE
// JOURNÉE, le total PAR JOB (site/ODT) et le TOTAL HEBDOMADAIRE (avec régulier/supplémentaire au-delà de
// 40 h) — les quatre niveaux demandés. Les punchs en attente de validation (nouveau site ou
// Entrepôt/Bureau, mécanisme v55) se valident ou se corrigent directement dans cet écran, sans aller
// ailleurs. Sélection par employé (ceux encore en punch sont exclus tant que leur quart n'est pas
// terminé), impression d'un document signable par employé (A4, même circuit d'impression que le reste de
// l'app) et génération d'un brouillon de courriel par employé vers SON adresse (Outlook/Gmail, exactement
// le même mécanisme que l'envoi employé existant) + une synthèse équipe pour le superviseur. La
// réconciliation des doublons de sites est exécutée AUTOMATIQUEMENT à la sortie des feuilles, comme
// demandé, avec accès direct au module Sites pour fusionner. Envoi 100 % automatique (sans passer par la
// boîte courriel) volontairement NON activé : il demande de brancher un service d'envoi au serveur —
// l'écran le dit clairement plutôt que de faire semblant. Côté serveur : nouvelle table
// feuilles_temps_envois (traçabilité Loi 25 : qui a sorti quelle feuille, quand, par quel moyen),
// synchronisée comme les autres tables, pour que l'information « feuille déjà sortie » soit visible sur
// TOUS les appareils et non seulement sur le téléphone du superviseur. Aucune fonction de calcul
// Temps/Suivi/Cumul existante n'a été modifiée (vérifié par comparaison automatique avec la v56) : le
// nouvel écran LIT les mêmes données et n'écrit que par les mécanismes déjà en place.)
// (v56 — Corrections suite aux retours sur la v55, groupées en un seul dépôt : (1) Le compte "admin" est un
// compte de gestion, pas un technicien — il n'apparaît plus dans AUCUNE liste d'employés assignables
// (Planning, créneaux, Plan de Match, tâches récurrentes) ni dans la "charge par technicien"/les lignes
// auto-générées de Planning Équipe/le sélecteur "Tout le monde" du Plan de Match — seul le module WO
// l'excluait déjà correctement, les autres non. (2) Une tâche Planning assignée à un employé n'apparaissait
// nulle part sur SA page Temps tant qu'il n'avait pas déjà cliqué "Arriver" pour ouvrir le modal de punch —
// ajouté une section "📌 Assigné aujourd'hui" directement sur la page Temps (visible avant même de démarrer
// un punch), cliquable pour puncher en un geste, réutilisant les fonctions déjà existantes et testées
// (getTodayAssignedJobs/openPrefilledPunch) — purement additif, aucun calcul touché. (3) Un punch en
// attente de validation (nouveau site ou Entrepôt/Bureau) ne remontait que dans Suivi, qu'il fallait
// penser à consulter — ajouté une alerte sur le "Poste de commande" (page d'accueil du superviseur, la
// toute première chose vue en ouvrant l'app) pour les punchs ET les sites en attente de validation. Cette
// app n'a pas de notification push serveur (désactivée volontairement, voir historique ci-dessous) — c'est
// l'équivalent le plus visible possible sans construire une vraie infrastructure de notifications. (4)
// Depuis le modal Planning, un nouveau site peut maintenant être créé directement si celui qu'on cherche
// n'existe pas (comme au punch/créneau) — avec protection anti-doublon : si le nom tapé ressemble fortement
// à un site déjà au répertoire, le système propose de réutiliser ce site existant plutôt que d'en créer un
// nouveau, sans jamais bloquer la sauvegarde de la tâche. (5) Ajouté un outil de réconciliation dans le
// module Sites (visible en haut de la liste pour un superviseur/admin) qui repère automatiquement les
// paires de sites déjà au répertoire dont les noms se ressemblent fortement, avec un bouton "Fusionner"
// direct pour chaque paire détectée. Vérifié par comparaison automatique de fonctions avec la v55 : seules
// les fonctions visées ont changé, aucune autre (dont aucune fonction protégée de calcul Temps/Suivi/Cumul).
// (v55 — Quatre demandes groupées en un seul dépôt : (1) Statut deux étapes « Terminé » (employé) →
// « Validé » (superviseur), ajouté à TOUS les types de tâches (Work Orders, créneaux/calendrier des
// interventions, tâches Planning, sous-tâches du Plan de Match) — visible dans les fiches (bandeau avec
// boutons), dans Planning (chip grisé/coché), dans le Gantt Jobs (barre grisée + icône, RESTE VISIBLE —
// ne disparaît plus comme avant — avec une case "Masquer les terminés" pour qui veut filtrer), dans
// Opérations/Vue Globale (KPI + alerte "à valider") et dans Stats (compteur En cours / À valider / Validé).
// Purement additif : nouveaux champs termine/termineBy/termineAt/valide/valideBy/valideAt, aucun champ
// existant modifié, aucun calcul touché. (2) Sites en double : un site créé automatiquement depuis un
// punch ou un créneau (nouveau lieu tapé) est maintenant marqué "🕓 À valider" au lieu de rejoindre le
// répertoire sans supervision — le module Sites permet à un superviseur de l'Approuver, le Fusionner avec
// un site existant (réattribue automatiquement les créneaux/tâches planning liés puis supprime le
// doublon) ou le Rejeter. (3) Un employé qui tape un lieu/site qui n'est pas dans le répertoire peut
// toujours puncher normalement — jamais bloqué — mais ce punch est marqué "en attente de validation" et
// remonte dans Suivi pour confirmation par un superviseur/directeur (bouton "✏️ Corriger" existant, avec
// une case "Approuver ce punch"). (4) Un punch sur l'Entrepôt ou le Bureau reste entièrement accessible à
// tous les employés (jamais cachés/restreints) mais suit exactement le même mécanisme de validation que
// (3) : le punch est enregistré tout de suite, puis attend l'approbation d'un superviseur/directeur.
// Vérifié par comparaison automatique de fonctions avec la v54 : seules les fonctions listées ci-dessus
// ont changé (dont openPunchEdit/savePunchEdit, modifiées uniquement pour AJOUTER la case d'approbation —
// aucun calcul d'heures touché), aucune autre fonction protégée de Temps/Suivi/Cumul.
// (v54 — Quatre demandes groupées en un seul dépôt : (1) Planning Équipe : bouton "🖨️ Imprimer" — liste
// propre par technicien/site pour la période affichée, même circuit d'impression que le reste de l'app ;
// le format d'impression de TOUTE l'app passe de Letter à A4 (demande explicite). (2) Comptes : un compte
// peut maintenant être marqué "Inactif" (login bloqué côté serveur ET client, exclu des statistiques, des
// listes d'attribution, de Planning/Plan de Match/Suivi) et/ou "Saisonnier" (étiquette informative) —
// aucune donnée historique supprimée, juste masquée du fonctionnement quotidien tant qu'inactif. Colonnes
// `statut`/`saisonnier` ajoutées à la table comptes, fonction serveur verifier_connexion mise à jour pour
// bloquer aussi les comptes désactivés (sécurité : jamais seulement côté client). (3) Navigation : Sortie
// Inventaire + Bon de Livraison regroupés sous un seul onglet "Logistique" avec sous-onglets (même principe
// déjà utilisé pour Plan de Match/WO/Créneaux) — moins d'onglets dans la barre de nav. (4) Temps : correctif
// du dépunch automatique de 20h00 — il ne vérifiait QUE le jour actuellement affiché à l'écran, et seulement
// pendant qu'une session avec l'app ouverte tournait exactement à ce moment-là ; un employé qui fermait
// l'app avant 20h (cas normal) restait donc "punché" indéfiniment sur ce jour, invisible pour toujours une
// fois le calendrier passé au lendemain. Corrigé : la vérification balaie maintenant tous les jours de la
// semaine chargée et ferme tout jour déjà passé encore actif, en plus du jour courant à 20h — vérifiée
// aussi une fois immédiatement à la connexion, pas seulement toutes les 60s. Suivi affiche désormais aussi
// un avertissement si un punch reste actif sur un AUTRE jour que celui affiché, avec accès direct à la
// correction. Vérifié par comparaison automatique de fonctions avec la v53 : seules les fonctions
// listées ci-dessus ont changé, aucune autre (dont aucune fonction de calcul Temps/Suivi/Cumul).
// (v53 — Deux demandes : (1) Gantt Jobs : bouton "🖨️ Imprimer / Envoyer" (génère une liste imprimable
// propre, réutilise le circuit d'impression déjà en place ailleurs dans l'app — sur iPhone, la boîte de
// dialogue d'impression permet d'enregistrer/partager en PDF directement) + les barres du Gantt sont
// maintenant cliquables et ouvrent directement le WO/créneau/tâche planning correspondant. (2) Les tâches
// Planning peuvent maintenant être attribuées à PLUSIEURS employés à la fois, au choix : "tâche partagée"
// (un seul enregistrement, statut commun, visible dans le Plan de Match/Temps/Gantt de chacun) ou "copies
// indépendantes" (une tâche séparée par employé, statut propre à chacun). Tous les endroits qui lisaient
// l'ancien champ simple emp (Planning, Plan de Match, Temps, auto-liaison rétroactive, Gantt) ont été mis
// à jour via une fonction commune planningAssignees(), compatible avec les anciennes tâches à 1 seul
// employé — aucune donnée existante à migrer. Aucune fonction protégée de Temps/Suivi/Cumul touchée
// (vérifié : aucune fonction existante modifiée hors de celles listées ci-dessus, par comparaison
// automatique avec la v52).
// (v52 — Lenteur signalée par toute l'équipe sur cellulaire, à l'ouverture ET dans les actions. Cause
// racine trouvée : (1) chaque évènement realtime Supabase (un punch, un WO, une tâche modifiée PAR
// N'IMPORTE QUI de l'équipe) déclenchait un re-téléchargement COMPLET de la table concernée (photos
// incluses) sur TOUS les téléphones connectés, en boucle toute la journée — corrigé en fusionnant
// seulement la ligne modifiée (déjà transmise par l'évènement) au lieu de tout retélécharger ; les
// suppressions (rares) continuent de passer par le pull complet existant, inchangé. (2) Les en-têtes
// de cache "no-store" (ajoutées en v49 pour ne plus rester coincé sur une vieille version) empêchaient
// TOUTE mise en cache, donc index.html (~700 Ko) était retéléchargé en entier à CHAQUE ouverture même
// sans changement — corrigé en gardant seulement "no-cache" (revalidation obligatoire + réponse 304
// quasi instantanée quand rien n'a changé, au lieu de "no-store" qui interdisait toute réponse rapide).
// Aucune fonction protégée de Temps/Suivi/Cumul touchée (vérifié byte-for-byte).
// (v51 — Peu importe qui est connecté, l'employé ne voyait dans Temps (widget "Assigné aujourd'hui" +
// sélecteur rapide au punch) que les WO et créneaux qui lui étaient assignés, jamais ses tâches
// Planning. Étendu la fonction partagée getTodayAssignedJobs() (déjà utilisée par l'Accueil ET par
// Temps, purement additive — AUCUNE fonction protégée de Temps/Suivi/Cumul modifiée, vérifié
// byte-for-byte) pour inclure aussi les tâches Planning non liées à un WO/créneau du jour, avec le
// bouton "▶ Puncher" comme pour un WO ou un créneau.
// (v50 — Le module Planning n'affichait nulle part les tâches "libres" (non liées à un créneau/WO) dans
// le Plan de Match des employés : renderPlanMatch() (vue employé), renderPmmAll() (vue superviseur
// "Tout le monde") et les impressions (pmmBuildPrintHTML/printTeamDay/printOneEmployeeDay) ne lisaient
// jamais planning_tasks. Résultat : TOUTES les anciennes tâches Planning de Charles, jamais liées à un
// créneau/WO, restaient invisibles dans le Plan de Match. Elles s'affichent maintenant automatiquement,
// exactement comme les WO et créneaux le font déjà (section "🗓 Tâches planning").
// (v49 — corrige le badge de version en bas à droite de l'app : il affichait le texte figé "build F43"
// depuis longtemps, sans AUCUN lien avec la vraie version déployée — donc impossible de s'y fier pour
// vérifier un déploiement. Il reflète maintenant la variable APP_BUILD, à garder synchronisée avec ce
// CACHE_NAME à chaque changement).

var CACHE_NAME = 'sa-platform-v63';

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
