// SA Platform — Service Worker
// v52 — Lenteur signalée par toute l'équipe sur cellulaire, à l'ouverture ET dans les actions. Cause
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

var CACHE_NAME = 'sa-platform-v52';

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
