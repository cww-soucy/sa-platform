// SA Platform — Service Worker
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

var CACHE_NAME = 'sa-platform-v65';

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
