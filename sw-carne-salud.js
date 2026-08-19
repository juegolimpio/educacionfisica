const CACHE_NAME='juegolimpio-carne-salud-v3';
const CORE_ASSETS=[
  './carne-salud.html',
  './manifest.webmanifest',
  './icons/carne-salud.svg',
  './icons/carne-salud-192.png',
  './icons/carne-salud-512.png',
  './vendor/xlsx.full.min.js'
];

function isCarneAsset(request){
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return false;
  const path=url.pathname;
  return path.endsWith('/carne-salud.html')||
    path.endsWith('/manifest.webmanifest')||
    path.endsWith('/icons/carne-salud.svg')||
    path.endsWith('/icons/carne-salud-192.png')||
    path.endsWith('/icons/carne-salud-512.png')||
    path.endsWith('/vendor/xlsx.full.min.js');
}

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
  if(event.request.method!=='GET'||!isCarneAsset(event.request))return;
  event.respondWith((async()=>{
    const cached=await caches.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    try{
      const response=await fetch(event.request);
      if(response&&response.ok){
        const cache=await caches.open(CACHE_NAME);
        cache.put(event.request,response.clone()).catch(()=>{});
      }
      return response;
    }catch(error){
      if(event.request.mode==='navigate'){
        const fallback=await caches.match('./carne-salud.html');
        if(fallback)return fallback;
      }
      throw error;
    }
  })());
});
