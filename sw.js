// SA Platform — Service Worker
// v50 — Le module Planning n'affichait nulle part les tâches "libres" (non liées à un créneau/WO) dans
// le Plan de Match des employés : renderPlanMatch() (vue employé), renderPmmAll() (vue superviseur
// "Tout le monde") et les impressions (pmmBuildPrintHTML/printTeamDay/printOneEmployeeDay) ne lisaient
// jamais planning_tasks. Résultat : TOUTES les anciennes tâches Planning de Charles, jamais liées à un
// créneau/WO, restaient invisibles dans le Plan de Match. Elles s'affichent maintenant automatiquement,
// exactement comme les WO et créneaux le font déjà (section "🗓 Tâches planning").
// (v49 — corrige le badge de version en bas à droite de l'app : il affichait le texte figé "build F43"
// depuis longtemps, sans AUCUN lien avec la vraie version déployée — donc impossible de s'y fier pour
// vérifier un déploiement. Il reflète maintenant la variable APP_BUILD, à garder synchronisée avec ce
// CACHE_NAME à chaque changement).

var CACHE_NAME = 'sa-platform-v50';

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
