// Generated manifest and runtime metadata come from the same version.json input.
const RELEASE = /* BUILD_MANIFEST */ null;
if (RELEASE) {
  const CACHE_NAME = 'lumen-shell-' + RELEASE.info.build;
  const absolute = path => new URL(path, self.registration.scope).href;
  const hex = bytes => [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  async function verified(path) {
    const response = await fetch(absolute(path), { cache: 'no-store' });
    if (!response.ok) throw Error('Incomplete release: ' + path);
    const hash = hex(await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer()));
    if (hash !== RELEASE.assets[path]) throw Error('Release integrity mismatch: ' + path);
    return response;
  }
  self.addEventListener('message', event => {
    if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
    if (event.data?.type === 'GET_BUILD') event.ports[0]?.postMessage(RELEASE.info);
  });
  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      // Validate every response before writing anything. A partial deployment
      // must never become a successfully installed offline shell.
      const responses = await Promise.all(Object.keys(RELEASE.assets).map(async path => [path, await verified(path)]));
      const cache = await caches.open(CACHE_NAME);
      for (const [path, response] of responses) await cache.put(absolute(path), response);
    })());
    // An existing client must explicitly activate a waiting update.
  });
  self.addEventListener('activate', event => {
    // Keep old immutable releases: an open old tab can still import its own
    // modules after controllerchange. Never purge user or unrelated caches.
    event.waitUntil(self.clients.claim());
  });
  self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url), scope = new URL(self.registration.scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
    const path = url.pathname.slice(scope.pathname.length);
    if (path === 'version.json' && url.search) {
      // Latest means network only; an offline response cannot impersonate latest.
      event.respondWith(fetch(request, { cache: 'no-store' })); return;
    }
    if (path.startsWith('builds/')) {
      event.respondWith((async () => {
        const cached = await caches.match(absolute(path));
        if (cached) return cached;
        if (RELEASE.assets[path]) return verified(path);
        // Old, noncached immutable resource: network may fail, never substitute
        // the current build's similarly named module or stylesheet.
        return fetch(request);
      })()); return;
    }
    if (['', 'index.html', 'manifest.json', 'version.json'].includes(path)) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(absolute(path || 'index.html')) || verified(path || 'index.html');
      })());
    }
  });
}
