// Network-first static shell; imported media stays in IndexedDB.
// This storage namespace is independent of the application version.
const CACHE_NAME = "lumen-shell-manual";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./version.json",
  "./src/styles/main.css",
  "./src/main.js",
  "./src/lyrics/lrc.mjs",
  "./src/database/db.js",
  "./src/services/audioEngine.js",
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
  "./src/utils/dom.js",
  "./src/utils/format.js",
  "./src/utils/id.js",
  "./src/utils/zip.js",
  "./src/utils/inflate.js",
  "./src/utils/platform.js",
  "./src/locales/en.json",
  "./src/locales/zh-CN.json",
  "./src/locales/fa.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/maskable-512.png",
];


const absolute = path => new URL(path, self.registration.scope).href;
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(APP_SHELL.map(path => new Request(absolute(path), { cache: "reload" })))
  ));
  // Default lifecycle: close all app windows to activate a changed worker.
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Retire only this app's historical numbered shell caches.
    await Promise.all(keys.filter(key => /^lumen-shell-v\d+$/.test(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  if (!APP_SHELL.some(path => absolute(path) === url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    let response;
    try {
      response = await fetch(event.request, { cache: "no-cache" });
      if (!response.ok) throw new Error("Shell request failed: " + response.status);
    } catch (error) {
      const cached = await cache.match(url.href);
      if (cached) return cached;
      throw error;
    }
    // Storage failure must not discard a successful network response.
    try { await cache.put(url.href, response.clone()); }
    catch (error) { console.warn("SW cache write failed", error); }
    return response;
  })());
});
