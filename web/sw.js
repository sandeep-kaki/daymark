const scopePrefix='daymark-shell-'+encodeURIComponent(self.registration.scope)+'-';
const cacheName=scopePrefix+'v2.0.0';
const assets=['./','./index.html','./styles.css','./manifest.webmanifest','./icon.svg','./appearance.css','./src/appearance.js','./src/pip.js','./fonts/dm-sans.ttf','./src/app.js','./src/domain.js','./src/store.js','./src/ui.js','./src/views.js','./src/cloud.js','./src/sync-model.js','./firebase-config.json','./vendor/firebase.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(cacheName);await cache.addAll(assets.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('daymark-shell-') && key.startsWith(scopePrefix)&&key!==cacheName)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    if(event.request.url===new URL('firebase-config.json',self.registration.scope).href){
      try{
        const response=await fetch(event.request,{cache:'no-cache'});
        if(response.ok){await cache.put(event.request,response.clone());return response;}
      }catch{/* Use the installed configuration offline. */}
    }
    return await cache.match(event.request.mode==='navigate'?'./index.html':event.request)||fetch(event.request);
  })());
});
