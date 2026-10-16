const CACHE_PREFIX = 'censo-pwa-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-v1`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-v1`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline-assets.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
];
const MAX_CACHED_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(APP_SHELL);
      const shell = await cache.match('/index.html');
      const assetManifest = await cache.match('/offline-assets.json');
      const bundledAssets = assetManifest ? await assetManifest.json() : [];
      if (shell) {
        const html = await shell.text();
        const referencedAssets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
          .map((match) => new URL(match[1], self.location.origin))
          .filter((url) => url.origin === self.location.origin)
          .map((url) => `${url.pathname}${url.search}`);
        await cache.addAll([...new Set([...referencedAssets, ...bundledAssets])]);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function storeAsset(request, response) {
  if (!response.ok || response.type === 'opaque') return;
  const cache = await caches.open(ASSET_CACHE);
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  if (keys.length > MAX_CACHED_ASSETS) {
    await cache.delete(keys[0]);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    const networkResponse = fetch(request);
    event.waitUntil(
      networkResponse.then(async (response) => {
        if (response.ok) {
          await caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', response.clone()));
        }
      }).catch(() => undefined),
    );
    event.respondWith(networkResponse.catch(async () => {
      const cached = await caches.match('/index.html');
      return cached ?? Response.error();
    }));
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  const cachedResponse = caches.match(request);
  const refreshedResponse = fetch(request).then(async (response) => {
    await storeAsset(request, response);
    return response;
  });
  event.waitUntil(refreshedResponse.then(() => undefined).catch(() => undefined));
  event.respondWith((async () => {
    const cached = await cachedResponse;
    if (cached) return cached;
    try {
      return await refreshedResponse;
    } catch {
      return Response.error();
    }
  })());
});
