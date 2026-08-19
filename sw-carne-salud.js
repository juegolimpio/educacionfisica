const CACHE_NAME='juegolimpio-carne-salud-v2';
const CORE_ASSETS=[
  './carne-salud.html',
  './manifest.webmanifest',
  './icons/carne-salud.svg',
  './vendor/xlsx.full.min.js'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME&&k.startsWith('juegolimpio-carne-salud-')).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    try{
      const response=await fetch(event.request);
      if(response&&response.ok&&new URL(event.request.url).origin===self.location.origin){
        const cache=await caches.open(CACHE_NAME);
        cache.put(event.request,response.clone());
      }
      return response;
    }catch(error){
      if(event.request.mode==='navigate')return caches.match('./carne-salud.html');
      throw error;
    }
  })());
});
