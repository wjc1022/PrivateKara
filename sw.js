// version.json is the only release version source; its build selects the worker URL.
const BUILD = Number(new URL(self.location.href).searchParams.get('build'));
const CACHE_NAME = 'lumen-shell-build-' + BUILD;
const absolute = path => new URL(path, self.registration.scope).href;
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./src/styles/main.css",
  "./src/main.js",
  "./src/lyrics/lrc.mjs",
  "./src/database/db.js",
  "./src/services/audioEngine.js",
  "./src/services/playerPresentation.js",
  "./src/services/mediaDiagnostics.js",
  "./src/services/mediaTimeline.js",
  "./src/components/mediaDiagnostics.js",
  "./src/services/playerPreferences.js",
  "./src/services/coverService.js",
  "./src/services/i18nService.js",
  "./src/services/importService.js",
  "./src/services/lyricFile.js",
  "./src/components/songResources.js",
  "./src/services/lmpService.js",
  "./src/services/metadataService.js",
  "./src/services/phoneMusicService.js",
  "./src/services/sleepTimerService.js",
  "./src/services/sortService.js",
  "./src/services/themeService.js",
  "./src/services/transferService.js",
  "./src/services/updateService.js",
  "./src/services/versionService.js",
  "./src/pages/about.js",
  "./src/pages/favorites.js",
  "./src/pages/home.js",
  "./src/pages/library.js",
  "./src/pages/phoneMusic.js",
  "./src/pages/playlists.js",
  "./src/pages/settings.js",
  "./src/components/emptyState.js",
  "./src/components/importPanel.js",
  "./src/components/lmpDialog.js",
  "./src/components/playerLyrics.js",
  "./src/components/miniPlayer.js",
  "./src/components/playerSheet.js",
  "./src/components/sideMenu.js",
  "./src/components/songRow.js",
  "./src/components/sortControl.js",
  "./src/components/updateDialog.js",
  "./src/utils/dom.js",
  "./src/utils/format.js",
  "./src/utils/id.js",
  "./src/utils/zip.js",
  "./src/utils/inflate.js",
  "./src/utils/platform.js",
  "./src/utils/semver.js",
  "./src/locales/en.json",
  "./src/locales/zh-CN.json",
  "./src/locales/fa.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/maskable-512.png",
];


self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
  if (event.data?.type === 'GET_BUILD') event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(absolute('version.json'));
    event.ports[0]?.postMessage(response ? await response.json() : null);
  })());
});
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(absolute('version.json') + '?install=' + BUILD, { cache: 'no-store' });
    if (!response.ok) throw Error('Version unavailable');
    const info = await response.clone().json();
    if (!Number.isSafeInteger(BUILD) || BUILD < 1 || info.build !== BUILD) throw Error('Release changed; check for updates again');
    const existed = (await caches.keys()).includes(CACHE_NAME);
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(APP_SHELL.map(path => new Request(absolute(path), { cache: 'reload' })));
      await cache.put(absolute('version.json'), response);
    } catch (error) { if (!existed) await caches.delete(CACHE_NAME); throw error; }
  })());
  // Existing clients explicitly accept a waiting worker before activation.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Never delete unrelated caches or IndexedDB media.
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('lumen-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path === 'version.json' && url.search) {
    event.respondWith(fetch(event.request, { cache: 'no-store' })); return;
  }
  const asset = path || 'index.html';
  if (!APP_SHELL.some(item => absolute(item) === absolute(asset)) && asset !== 'version.json') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(absolute(asset)) || fetch(event.request);
  })());
});
