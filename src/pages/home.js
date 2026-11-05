/**
 * pages/home.js
 * ---------------------------------------------------------------
 * First thing users see. If the library is empty, shows the
 * "No music found" empty state with an import CTA. Otherwise shows
 * a recently played shelf, or a prompt to play from the library.
 * ---------------------------------------------------------------
 */

import { el, clearNode } from "../utils/dom.js";
import { Songs, Recents } from "../database/db.js";
import { createSongRow } from "../components/songRow.js";
import { createEmptyState } from "../components/emptyState.js";
import { t } from "../services/i18nService.js";
import { selectSong, getCurrentSong, toggleFavorite, on } from "../services/audioEngine.js";

// renderHome() runs every time the user navigates to Home. Without
// tracking this, each visit would add another "trackchange" listener
// bound to the previous render's (now-detached) container, leaking
// memory and doing redundant work forever. Only one stays live.
let unsubscribeTrackChange = null;

export async function renderHome(container, { onImportRequested }) {
  clearNode(container);
  unsubscribeTrackChange?.();
  unsubscribeTrackChange = null;

  const allSongs = await Songs.all();

  if (!allSongs.length) {
    container.appendChild(
      el("div", { class: "page-head" }, [
        el("h1", { "data-i18n": "home.title" }, t("home.title")),
        el("p", { class: "sub", "data-i18n": "home.subtitle" }, t("home.subtitle")),
      ])
    );
    container.appendChild(
      createEmptyState({
        title: t("home.emptyTitle"),
        body: t("home.emptyBody"),
        actionLabel: t("home.importFirst"),
        onAction: onImportRequested,
      })
    );
    return;
  }

  const head = el("div", { class: "page-head" }, [
    el("h1", {}, t("home.title")),
    el("p", { class: "sub" }, t("home.subtitle")),
  ]);
  container.appendChild(head);

  // ---- recently played ----
  const recents = await Recents.all();
  const recentSongs = recents
    .map((r) => allSongs.find((s) => s.id === r.id))
    .filter(Boolean)
    .slice(0, 5);

  if (recentSongs.length) {
    container.appendChild(el("h2", { class: "section-label" }, t("home.recentlyPlayed")));
    const list = el("div", { class: "song-list" });
    recentSongs.forEach((song) => list.appendChild(buildRow(song, recentSongs)));
    container.appendChild(list);
  } else {
    container.appendChild(createEmptyState({
      title: t("home.noRecentsTitle"),
      body: t("home.noRecentsBody"),
    }));
  }

  function refreshPlayingHighlight() {
    const current = getCurrentSong();
    container.querySelectorAll(".song-row").forEach((row) => {
      row.classList.toggle("playing", !!current && row.dataset.id === current.id);
    });
  }
  unsubscribeTrackChange = on("trackchange", refreshPlayingHighlight);
}

function buildRow(song, queue) {
  const current = getCurrentSong();
  return createSongRow(song, {
    isPlaying: !!current && current.id === song.id,
    onPlay: (s) => selectSong(s, queue),
    onToggleFavorite: (s) => toggleFavorite(s),
  });
}
