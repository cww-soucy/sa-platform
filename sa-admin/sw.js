// Ancien prototype retiré (03/10/2026) : ce service worker se désinstalle, efface ses caches et renvoie vers /admin.html.
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return /^sa-admin-/.test(k);}).map(function(k){return caches.delete(k);}));})
  .then(function(){return self.registration.unregister();}).then(function(){return self.clients.matchAll({type:'window'});}).then(function(cs){cs.forEach(function(c){c.navigate('/admin.html');});}));});
