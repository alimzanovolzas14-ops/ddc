var CACHE='ddc-portal-v1';
var CORE=['portal.html','portal-db.js','config.js','dashboard.html','img/icon-192.png','img/icon-512.png','img/ddc_mark_white.png','img/ddc_mark_blue.png','manifest.webmanifest'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE).catch(function(){});}));self.skipWaiting();});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.map(function(k){if(k!==CACHE)return caches.delete(k);}));}));self.clients.claim();});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var u=req.url;
  if(u.indexOf('supabase')>=0||u.indexOf('workers.dev')>=0||u.indexOf('/load')>=0||u.indexOf('/save')>=0)return;
  e.respondWith(
    caches.match(req).then(function(cached){
      var net=fetch(req).then(function(res){if(res&&res.status===200&&u.indexOf('http')===0){var copy=res.clone();caches.open(CACHE).then(function(c){c.put(req,copy).catch(function(){});});}return res;}).catch(function(){return cached;});
      return cached||net;
    })
  );
});
