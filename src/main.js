/**
 * main.js
 * ---------------------------------------------------------------
 * Entry point. Boots the database-backed services, wires up the
 * side menu / mini player / lyrics modal / import panel, and
 * implements a tiny page router (no framework needed for five
 * pages with no nested routes).
 *
 * Lumen — created by Behnood Shafiei
 * https://github.com/Behnooddev
 * ---------------------------------------------------------------
 */

import { $, $$ } from "./utils/dom.js";
import { initI18n, onLanguageChange } from "./services/i18nService.js";
import { initTheme } from "./services/themeService.js";
import { initSideMenu } from "./components/sideMenu.js";
import { initMiniPlayer } from "./components/miniPlayer.js";
import { initPlayerSheet } from "./components/playerSheet.js";
import { initImportPanel } from "./components/importPanel.js";
import { Songs } from "./database/db.js";

import { renderHome } from "./pages/home.js";
import { renderLibrary } from "./pages/library.js";
import { renderPlaylists } from "./pages/playlists.js";
import { renderFavorites } from "./pages/favorites.js";
import { renderPhoneMusic } from "./pages/phoneMusic.js";
import { renderSettings } from "./pages/settings.js";
import { renderAbout } from "./pages/about.js";
import { restorePlaybackPreferences } from "./services/audioEngine.js";

// Registered as early as possible, independent of the async boot() chain
// below. boot() awaits several things (locale fetch, IndexedDB reads)
// before it would otherwise reach this line — by then the window's
// `load` event may have already fired, silently skipping registration.
// Registering here, synchronously, at module-evaluation time avoids
// that race. A readyState check covers the (rarer) case where this
// module itself finishes loading after `load` has already fired.
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch((err) => {
    console.warn("Service worker registration failed:", err);
  });
}
if (document.readyState === "complete") {
  registerServiceWorker();
} else {
  window.addEventListener("load", registerServiceWorker, { once: true });
}

const PAGES = {
  home: (container, ctx) => renderHome(container, ctx),
  library: (container, ctx) => renderLibrary(container, ctx),
  playlists: (container) => renderPlaylists(container),
  favorites: (container) => renderFavorites(container),
  phoneMusic: (container, ctx) => renderPhoneMusic(container, ctx),
  settings: (container, ctx) => renderSettings(container, ctx),
  about: (container) => renderAbout(container, appVersion),
};

let currentPage = "home";
const main = $("#main");

async function renderPage(pageName) {
  currentPage = pageName;
  $$(".page-container").forEach((p) => p.classList.remove("active"));
  const container = $(`#page-${pageName}`);
  container.classList.add("active");

  await PAGES[pageName](container, {
    onImportRequested: () => importPanel.openPicker(),
    onSongRemoved: async (song) => { await Songs.remove(song.id); },
    onLanguageChanged: () => renderPage(currentPage),
    onDataReset: () => location.reload(),
  });
}

let importPanel;
let appVersion = "\u2014";

async function boot() {
  // Read once with this page; About navigation must not relabel a running page.
  try {
    const response = await fetch("version.json", { cache: "no-cache" });
    if (response.ok) appVersion = (await response.json()).version || "\u2014";
  } catch (error) { console.warn("Application version unavailable:", error); }

  await initI18n();
  await initTheme();
  await restorePlaybackPreferences();

  const sideMenu = initSideMenu({
    onNavigate: (page) => renderPage(page),
  });

  importPanel = initImportPanel({
    onImported: () => renderPage(currentPage),
  });



  initMiniPlayer();
  initPlayerSheet();

  onLanguageChange(() => renderPage(currentPage));

  await renderPage("home");
}

boot().catch(error=>{console.error(error);document.body.textContent='PrivateKara initialization failed: '+error.message;});

window.addEventListener('lumen-database-invalidated',()=>{document.body.textContent='PrivateKara database changed in another tab. Reload this page.';});
