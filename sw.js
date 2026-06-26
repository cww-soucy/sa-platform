// SA Platform — Service Worker
// Gère les notifications push et le cache hors-ligne

var CACHE_NAME = 'sa-platform-v1';

// Installation
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

// Réception d'une notification push (depuis le serveur)
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) { data = {title:'SA Platform', body:event.data ? event.data.text() : ''}; }

  var title = data.title || 'SA Platform';
  var options = {
    body: data.body || 'Nouvelle notification',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'sa-notif',
    data: data.url || '/',
    vibrate: [100, 50, 100]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur une notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(clientList) {
      // Si une fenêtre est déjà ouverte, la focus
      for (var i = 0; i < clientList.length; i++) {
        if ('focus' in clientList[i]) return clientList[i].focus();
      }
      // Sinon en ouvrir une
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
