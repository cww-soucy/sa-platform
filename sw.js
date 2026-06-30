// SA Platform — Service Worker
// NOTIFICATIONS DÉSACTIVÉES (à la demande). Conserve uniquement le cache hors-ligne.

var CACHE_NAME = 'sa-platform-v2';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Push DÉSACTIVÉ : on ignore tout push entrant → aucune notification persistante.
self.addEventListener('push', function(event) {
  // Volontairement vide : ne plus afficher de notification.
  return;
});

// Au cas où une notification résiduelle serait cliquée, on ouvre juste l'app.
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ('focus' in clientList[i]) return clientList[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
