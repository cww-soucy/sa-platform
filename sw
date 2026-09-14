// SA Platform — Service Worker
// NOTIFICATIONS DÉSACTIVÉES. Force la mise à jour du cache (v48 — corrige un vrai bug de mise en cache :
// sw.js et index.html n'étaient jamais explicitement marqués "no-cache", donc Cloudflare/le navigateur
// pouvait continuer à servir une ancienne version indéfiniment malgré un nouveau déploiement. Ajout d'un
// fichier _headers + updateViaCache:'none' à l'enregistrement du service worker pour empêcher ça à l'avenir).

var CACHE_NAME = 'sa-platform-v48';

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
