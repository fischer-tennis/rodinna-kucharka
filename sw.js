const CACHE='rodinna-kucharka-v2-0-1-stable';
const CORE=['./','index.html','style.css','app.js','recipes.json','manifest.json','icons/icon-32.png','icons/icon-96.png','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.all(CORE.map(file=>cache.add(file).catch(()=>null)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('index.html'))))});
