const CACHE_PREFIX = 'censo-pwa-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-v2`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-v2`;
const API_CACHE = `${CACHE_PREFIX}api-v2`;
const ACTIVE_CACHES = [SHELL_CACHE, ASSET_CACHE, API_CACHE];
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline-assets.json',
  '/offline.html',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
];
const USER_CACHE_HEADER = 'X-PWA-Cache-User';
const CACHE_USER_PARAMETER = '__pwa_cache_user';
const API_CACHE_PATHS = new Set(['/api/dashboard/data', '/api/reports/census-records']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(APP_SHELL);
      const assetManifest = await cache.match('/offline-assets.json');
      const bundledAssets = assetManifest ? await assetManifest.json() : [];
      await cache.addAll([...new Set(bundledAssets)]);
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && !ACTIVE_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function apiCacheKey(request, userId) {
  const url = new URL(request.url);
  url.searchParams.set(CACHE_USER_PARAMETER, userId);
  return new Request(url.toString());
}

function withoutCacheUserHeader(request) {
  const headers = new Headers(request.headers);
  headers.delete(USER_CACHE_HEADER);
  return new Request(request, { headers });
}

async function networkFirstApi(request) {
  const url = new URL(request.url);
  const userId = request.headers.get(USER_CACHE_HEADER);
  if (!userId || !API_CACHE_PATHS.has(url.pathname)) return fetch(withoutCacheUserHeader(request));

  let cache;
  try {
    cache = await caches.open(API_CACHE);
  } catch (error) {
    console.warn('Não foi possível abrir o cache de API; usando a rede.', error);
    return fetch(withoutCacheUserHeader(request));
  }
  const cacheKey = apiCacheKey(request, userId);
  let response;
  try {
    response = await fetch(withoutCacheUserHeader(request));
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
  if (response.status >= 500) return await cache.match(cacheKey) ?? response;
  if (response.ok
    && response.headers.get('Content-Type')?.includes('application/json')
    && !response.headers.get('Cache-Control')?.toLowerCase().includes('no-store')) {
    try {
      await cache.put(cacheKey, response.clone());
    } catch (error) {
      console.warn('Não foi possível atualizar o cache de API.', error);
    }
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/auth/') || url.pathname === '/api/analytics/decrypted-export') return;
    event.respondWith(networkFirstApi(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(SHELL_CACHE);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return await cache.match('/index.html')
          ?? await cache.match('/offline.html')
          ?? Response.error();
      }
    })());
    return;
  }

  if (!['script', 'style', 'image', 'font'].includes(request.destination)) return;

  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request) ?? await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        try {
          await cache.put(request, response.clone());
        } catch (error) {
          console.warn('Não foi possível armazenar este ativo para uso offline.', error);
        }
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }
  if (event.data?.type !== 'CLEAR_USER_API_CACHE' || typeof event.data.userId !== 'string') return;
  event.waitUntil((async () => {
    const cache = await caches.open(API_CACHE);
    const keys = await cache.keys();
    await Promise.all(keys.filter((key) => {
      const url = new URL(key.url);
      return url.searchParams.get(CACHE_USER_PARAMETER) === event.data.userId;
    }).map((key) => cache.delete(key)));
  })());
});
