const CACHE_NAME = 'pendraw-pwa-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // CDNライブラリも初回オンライン時にキャッシュを試みる。
    await Promise.all(CDN_ASSETS.map(async url => {
      try {
        const response = await fetch(url, { mode: 'cors', cache: 'reload' });
        if (response.ok) await cache.put(url, response.clone());
      } catch (e) {
        // CDNに接続できない場合でもPWA本体のインストールは継続。
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 同一オリジンのアプリ本体はキャッシュ優先。
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (e) {
        if (request.mode === 'navigate') {
          return (await cache.match('./index.html')) || Response.error();
        }
        return Response.error();
      }
    })());
    return;
  }

  // Fabric.js / QRCode.jsなど外部CDNは、オンライン時に取得して保存。
  if (CDN_ASSETS.includes(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request.url);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request.url, response.clone());
      return response;
    })());
  }
});
