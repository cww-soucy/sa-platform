// sa-terrain — Service Worker (hors-ligne)
// Stratégie : réseau d'abord pour la page (toujours la dernière version si en ligne), cache en secours.
// Polices Google : cache d'abord. Les appels Supabase ne sont jamais mis en cache.
var VERSION='sa-terrain-v1.0.0-design';
var CORE=['./','./index.html','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(VERSION).then(function(c){return c.addAll(CORE);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==VERSION;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.hostname.indexOf('supabase.co')>=0)return;
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.match(r).then(function(hit){return hit||fetch(r).then(function(res){var cp=res.clone();caches.open(VERSION).then(function(c){c.put(r,cp);});return res;});}));return;
  }
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(function(res){var cp=res.clone();caches.open(VERSION).then(function(c){c.put(r,cp);});return res;}).catch(function(){return caches.match(r).then(function(hit){return hit||caches.match('./index.html');});}));
});
