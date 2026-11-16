'use strict';
// 更新を配信するときは v1 を v2 などに変更します。
const PREFIX = 'my-task-' + self.registration.scope + ':';
const CACHE = PREFIX + 'v1';
const ASSETS = ['./', './index.html', './styles.css', './tasks.js', './app.js', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.href.startsWith(self.registration.scope)) return;
  // ページと資産を同じバージョンのキャッシュから返します。
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') {
      const path = url.pathname;
      const home = new URL('./', self.registration.scope).pathname;
      if (path === home || path === home + 'index.html') return cache.match('./index.html');
    }
    return fetch(event.request);
  })());
});
