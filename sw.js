const CACHE='rodinna-kucharka-v2-0-6-share';
const CORE=['./','index.html','style.css?v=2.0.5','app.js?v=2.0.5','recipes.json','manifest.json','icons/icon-32.png','icons/icon-96.png','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(CORE.map(file=>cache.add(file).catch(()=>null)));await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(r=>r).catch(()=>caches.match('index.html')));
    return;
  }
  if(url.origin===self.location.origin){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request)));
  }
});
