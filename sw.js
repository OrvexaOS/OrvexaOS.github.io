'use strict';

// Bump this version whenever the app shell changes. A new cache is populated
// from the network (bypassing the browser HTTP cache) before the worker activates.
const CACHE_PREFIX = 'orvexa-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v7';
const APP_SHELL = [
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/orvexa.svg',
  './windows/windowHandler.js',
  './windows/loadingHelper.js',
  './windows/pluginRuntime.js',
  './windows/pluginManager.js',
  './windows/systemPersistence.js',
  './windows/advancedApps.js',
  './windows/desktop.js',
  './windows/authSetup.js',
  './windows/pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url => {
      try {
        const request = new Request(url, { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(url, response);
        else console.warn('[OrvexaOS SW] Skipping unavailable asset:', url, response.status);
      } catch (error) {
        // A missing optional asset must never prevent the worker from installing.
        console.warn('[OrvexaOS SW] Could not refresh asset:', url, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Keep navigations and application code fresh when online, but still let the
  // installed shell start when offline. This avoids serving a broken old bundle.
  const isAppShell = request.mode === 'navigate' ||
    /\.(?:html|css|js|webmanifest)$/.test(url.pathname);

  if (isAppShell) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          const key = request.mode === 'navigate' ? './index.html' : request;
          await cache.put(key, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request) || await caches.match('./index.html');
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});
