'use strict';
const PREFIX = 'my-task-' + self.registration.scope + ':';
const CACHE = PREFIX + 'v1.1';
const ASSETS = ['./', './index.html', './styles.css', './tasks.js', './app.js', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  // ブラウザのHTTPキャッシュから旧版を再利用しない。
  event.waitUntil(caches.open(CACHE).then(cache =>
    cache.addAll(ASSETS.map(asset=>new Request(new URL(asset,self.registration.scope),{cache:'reload'})))));
});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
    // Ver.1.0には更新バナーがないため、旧画面も新バージョンに切り替える。
    const windows = await self.clients.matchAll({type:'window'});
    await Promise.all(windows.filter(client=>client.url.startsWith(self.registration.scope)).map(client=>client.navigate(client.url)));
  })());
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET')return;
  const url=new URL(event.request.url);
  if(!url.href.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate'){
      const home=new URL('./',self.registration.scope).pathname;
      if(url.pathname===home || url.pathname===home+'index.html')return cache.match(new URL('./index.html',self.registration.scope).href);
    }
    return fetch(event.request);
  })());
});
