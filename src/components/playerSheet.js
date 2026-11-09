import { getPlayerButtons, getLyricMode, nextLyricMode, cycleLyricMode } from '../services/playerPreferences.js';
/**
 * components/playerSheet.js
 * ---------------------------------------------------------------
 * The bottom sheet opened by tapping the mini player. This is the
 * central playback controller: synchronized lyrics, full transport controls,
 * shuffle/repeat, favorite, seek with time labels,
 * vocal/instrumental switching, and queue.
 * ---------------------------------------------------------------
 */

import { $, el, clearNode } from "../utils/dom.js";
import { localizeTime } from "../utils/format.js";
import { t, getLang, onLanguageChange } from "../services/i18nService.js";
import { createSongRow } from "./songRow.js";
import { initPlayerLyrics } from "./playerLyrics.js";
import {
  audioEl, on, togglePlay, playNext, playPrev, toggleFavorite, seekTo,
  setShuffle, isShuffleOn, getCurrentSong, getRepeatMode, cycleRepeatMode,
  switchVariant, getCurrentVariant, getVariantStatus,
  hasInstrumental, getQueue, playSong,
} from "../services/audioEngine.js";



export function initPlayerSheet() {
  const lyrics = initPlayerLyrics();
  const modal = $("#playerSheetModal");
  const videoHost = $("#videoHost");
  videoHost.appendChild(audioEl);
  const backdrop = $("#playerSheetBackdrop");
  const closeBtn = $("#playerSheetClose");
  const titleEl = $("#sheetTitle");
  const artistEl = $("#sheetArtist");

  const progressTrack = $("#sheetProgressTrack");
  const progressFill = $("#sheetProgressFill");
  const currentTimeEl = $("#sheetCurrentTime");
  const remainingTimeEl = $("#sheetRemainingTime");

  const shuffleBtn = $("#sheetShuffleBtn");
  const prevBtn = $("#sheetPrevBtn");
  const playBtn = $("#sheetPlayBtn");
  const playIcon = $("#sheetPlayIcon");
  const nextBtn = $("#sheetNextBtn");
  const repeatBtn = $("#sheetRepeatBtn");
  const repeatOneBadge = $("#repeatOneBadge");

  const favBtn = $("#sheetFavBtn");
  const variantBtn = $("#sheetVariantBtn");
  const queueBtn = $("#sheetQueueBtn");
  const queuePanel = $("#sheetQueuePanel");
  const errorToast = el("div", { class: "toast toast-error", role: "alert" });
  document.body.appendChild(errorToast);
  const notice = el('div', { class: 'toast', role: 'status' });
  document.body.appendChild(notice);
  on('playbacknotice', key => {
    notice.textContent = t(key); notice.classList.add('visible');
    setTimeout(() => notice.classList.remove('visible'), 6000);
  });
  let errorTimer;
  on("playbackerror", key => {
    clearTimeout(errorTimer);
    errorToast.textContent = t(key);
    errorToast.classList.add("visible");
    errorTimer = setTimeout(() => errorToast.classList.remove("visible"), 6000);
  });

  let isDragging = false;
  let dragPointerId;
  let lastVideoClick;
  const landscape = matchMedia('(orientation: landscape)');
  const controls = $('.player-sheet-controls'), secondary = $('.player-sheet-secondary-row');
  const subtitlesBtn = el('button',{class:'sheet-pill-btn',id:'sheetSubtitlesBtn','data-i18n':'player.hideSubtitles'},t('player.hideSubtitles'));
  secondary.append(subtitlesBtn);
  const moreBtn = el('button',{class:'sheet-pill-btn',id:'sheetMoreBtn','data-i18n':'player.more','aria-expanded':'false','aria-controls':'sheetMorePanel'},t('player.more'));
  const morePanel = el('div',{class:'sheet-more-panel',id:'sheetMorePanel',hidden:true});
  controls.append(moreBtn);secondary.after(morePanel);
  const buttons={shuffle:shuffleBtn,repeat:repeatBtn,favorite:favBtn,queue:queueBtn,variant:variantBtn,subtitles:subtitlesBtn};
  let audioSubtitles=true, hideTimer, keyboardFocus=false;
  const orientation = () => landscape.matches ? 'landscape' : 'portrait';
  let lastMode;
  function isLandscapeVideo() { return modal.classList.contains('open') && getCurrentSong()?.mediaType==='video'; }
  function reveal() {
    clearTimeout(hideTimer);modal.classList.remove('controls-hidden');
    for(const node of [controls,secondary,progressTrack,morePanel]) node.inert=false;
    if(!isLandscapeVideo() || audioEl.paused || isDragging || !queuePanel.hidden || !morePanel.hidden || keyboardFocus) return;
    hideTimer=setTimeout(hideControls,3000);
  }
  function hideControls() {
    clearTimeout(hideTimer);
    modal.classList.add('controls-hidden');
    for(const node of [controls,secondary,progressTrack,morePanel]) node.inert=true;
  }
  function dismissMenus() { morePanel.hidden=true;moreBtn.setAttribute('aria-expanded','false');queuePanel.hidden=true; }
  function layoutButtons() {
    const video=getCurrentSong()?.mediaType==='video',prefs=getPlayerButtons(),wide=isLandscapeVideo();
    const mode=video ? getLyricMode(orientation()) : (audioSubtitles ? 'side' : 'off');
    modal.classList.toggle('landscape-video',wide);
    modal.classList.toggle('subtitles-off',mode==='off');
    modal.classList.toggle('subtitles-bottom',video && mode==='bottom');
    modal.classList.toggle('subtitles-side',video && mode==='side');
    // The bottom overlay belongs to the sheet, outside the clipped video row.
    // Move the existing full-song DOM; side/audio keep their original flex host.
    const lyricBody=$('#lyricsBody'), visuals=$('.player-visuals');
    if (video && mode==='bottom') {
      if (lyricBody.parentElement!==visuals.parentElement) visuals.after(lyricBody);
    } else if (lyricBody.parentElement!==visuals) visuals.append(lyricBody);
    if (mode !== lastMode) { lastMode=mode; lyrics.refresh(); }
    $('#shuffleBtn').hidden=!prefs.shuffle;
    $('#miniFavBtn').hidden=!prefs.favorite;
    subtitlesBtn.setAttribute('aria-pressed',String(mode!=='off'));
    subtitlesBtn.dataset.i18n=video ? {side:'player.sideSubtitles',bottom:'player.bottomSubtitles',off:'player.offSubtitles'}[nextLyricMode(orientation(),mode)] : (audioSubtitles?'player.hideSubtitles':'player.showSubtitles');
    subtitlesBtn.textContent=t(subtitlesBtn.dataset.i18n);
    const order=[shuffleBtn,prevBtn,playBtn,nextBtn,repeatBtn,favBtn,variantBtn,queueBtn,subtitlesBtn];
    for(const [key,button] of Object.entries(buttons)) {
      button.hidden=!prefs[key] || (key==='variant' && video);
    }
    moreBtn.hidden=true;
    for(const button of order) (wide || [shuffleBtn,prevBtn,playBtn,nextBtn,repeatBtn].includes(button)?controls:secondary).append(button);
    controls.append(moreBtn);
    if(wide) {
      const visible=order.filter(b=>!b.hidden),gap=parseFloat(getComputedStyle(controls).columnGap)||0;
      const widths=new Map(visible.map(b=>[b,b.offsetWidth]));
      const required=()=>{
        const row=visible.filter(b=>b.parentElement===controls);
        return row.reduce((n,b)=>n+widths.get(b),0)+(moreBtn.hidden?0:moreBtn.offsetWidth)+Math.max(0,row.length+(moreBtn.hidden?0:1)-1)*gap;
      };
      const candidates=visible.filter(b=>![prevBtn,playBtn,nextBtn].includes(b)).reverse();
      while(required()>controls.clientWidth && candidates.length) {
        moreBtn.hidden=false;morePanel.prepend(candidates.shift());
      }
    }
    if(moreBtn.hidden) {morePanel.hidden=true;moreBtn.setAttribute('aria-expanded','false');}
    if(queueBtn.hidden) queuePanel.hidden=true;
    if(document.activeElement?.hidden) closeBtn.focus();
    updateBottomBounds();
    reveal();
  }
  subtitlesBtn.addEventListener('click',()=>{if(getCurrentSong()?.mediaType==='video') cycleLyricMode(orientation()); else audioSubtitles=!audioSubtitles;layoutButtons();});
  moreBtn.addEventListener('click',()=>{morePanel.hidden=!morePanel.hidden;moreBtn.setAttribute('aria-expanded',String(!morePanel.hidden));reveal();});
  window.addEventListener('playerbuttonschange',layoutButtons);
  landscape.addEventListener('change',()=>{dismissMenus();layoutButtons();});
  // Compare against the actual object-fit:contain picture, not the host box.
  function updateBottomBounds() {
    const body=$('#lyricsBody');
    if (!modal.classList.contains('subtitles-bottom')) {
      body.style.removeProperty('max-height');body.style.removeProperty('bottom');return;
    }
    const host=videoHost.getBoundingClientRect();
    const scale=Math.min(host.width/audioEl.videoWidth,host.height/audioEl.videoHeight);
    const pictureBottom=host.top+(host.height+audioEl.videoHeight*scale)/2;
    // In portrait, start immediately below the actual picture when the
    // natural lyrics fit before transport. Otherwise extend upward over video.
    // Positioning only affects the overlay, never the video host.
    if (!landscape.matches && modal.classList.contains('open')) {
      const sheet=$('.player-sheet'), sheetRect=sheet.getBoundingClientRect();
      const footerTop=Math.min(...[progressTrack,$('.player-sheet-time-row'),controls]
        .map(node=>node.getBoundingClientRect()).filter(rect=>rect.height>0).map(rect=>rect.top));
      if (Number.isFinite(footerTop)) {
        const borderBottom=parseFloat(getComputedStyle(sheet).borderBottomWidth)||0;
        const naturalHeight=body.scrollHeight;
        const fitsBelowPicture=Number.isFinite(pictureBottom) && naturalHeight>0 && pictureBottom+naturalHeight<=footerTop;
        const lyricsBottom=fitsBelowPicture ? pictureBottom+naturalHeight : footerTop;
        body.style.bottom=Math.max(0,sheetRect.bottom-borderBottom-lyricsBottom)+'px';
      }
    } else body.style.removeProperty('bottom');
    const blank=Number.isFinite(pictureBottom) ? Math.max(0,body.getBoundingClientRect().bottom-pictureBottom) : 0;
    // Hidden full-song lines can retain a different text size on iOS.
    // Measure text line heights from the displayed current/next nodes only.
    const lineHeights=[...body.querySelectorAll('.lyric-line.current, .lyric-line.next')]
      .map(node=>parseFloat(getComputedStyle(node).lineHeight))
      .filter(height=>Number.isFinite(height) && height>0);
    const lineHeight=lineHeights.length ? Math.max(...lineHeights) : parseFloat(getComputedStyle(body).lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight<=0) return;
    const twoLines=2*lineHeight;
    // scrollHeight retains natural wrapped content even while clipped.
    const limit=blank>=body.scrollHeight ? blank : twoLines;
    body.style.maxHeight=limit+'px';
  }
  audioEl.addEventListener('loadedmetadata',updateBottomBounds);
  const observer=new ResizeObserver(layoutButtons);
  observer.observe(videoHost);observer.observe(controls);
  const boundsObserver=new ResizeObserver(updateBottomBounds);
  for (const node of [$('#lyricsBody'),progressTrack,$('.player-sheet-time-row')]) boundsObserver.observe(node);
  new MutationObserver(updateBottomBounds).observe($('#lyricsBody'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.fonts?.ready.then(layoutButtons);
  onLanguageChange(layoutButtons);
  modal.addEventListener('pointerdown',e=>{
    keyboardFocus=false;
    if(!e.target.closest('#sheetMorePanel,#sheetMoreBtn,.sheet-panel,#sheetQueueBtn')) dismissMenus();
    if(!e.target.closest('#videoHost')) { lastVideoClick=undefined; reveal(); }
  },true);
  // Count clicks, not pointer events plus compatibility clicks. Touch clicks may
  // each have detail=1, so use time and distance rather than native dblclick.
  videoHost.addEventListener('click',e=>{
    if(!isLandscapeVideo() || isDragging) return;
    if(e.button !== 0) return;
    const previous=lastVideoClick;
    lastVideoClick=undefined;
    if(e.detail>0 && previous && (e.detail===2 || e.timeStamp-previous.time<=300) &&
       Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<=32) {
      e.preventDefault();
      togglePlay();
      reveal();
      return;
    }
    if(e.detail>0) lastVideoClick={time:e.timeStamp,x:e.clientX,y:e.clientY};
    if(modal.classList.contains('controls-hidden')) reveal();
    else hideControls();
  });
  modal.addEventListener('pointermove',e=>{if(e.pointerType==='mouse' && !e.target.closest('#videoHost'))reveal();});
  modal.addEventListener('keydown',()=>{keyboardFocus=true;reveal();});
  const focusSelector='.player-sheet-controls,.player-sheet-secondary-row,.sheet-more-panel,#sheetProgressTrack,.sheet-panel';
  document.addEventListener('keydown',e=>{if(e.key==='Tab') { keyboardFocus=true; if(isLandscapeVideo()) reveal(); }},true);
  modal.addEventListener('focusin',e=>{if(e.target.closest(focusSelector)) reveal();});
  modal.addEventListener('focusout',()=>queueMicrotask(()=>{keyboardFocus=keyboardFocus && !!document.activeElement?.closest(focusSelector);reveal();}));
  for(const event of ['play','pause','ended']) audioEl.addEventListener(event,reveal);

  function open() {
    if (!getCurrentSong()) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    renderSong(getCurrentSong());
    renderRepeatUI();
    renderShuffleUI();
    renderVariantUI();
    lyrics.open(getCurrentSong());
    updateProgressUI(audioEl.currentTime, audioEl.duration);
    closeBtn.focus();
    layoutButtons();
  }

  function close() {
    lastVideoClick=undefined;
    endDrag({pointerId:dragPointerId});
    dismissMenus();keyboardFocus=false;clearTimeout(hideTimer);
    modal.classList.remove('controls-hidden');
    lyrics.close();
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    queuePanel.hidden = true;
    layoutButtons();
    $("#miniExpand").focus();
  }

  function renderSong(song) {
    if (!song) return;
    const video = song.mediaType === "video";
    modal.classList.toggle("has-video", video);
    videoHost.hidden = !video;
    titleEl.textContent = song.title;
    artistEl.textContent = song.artist;
    favBtn.classList.toggle("active", !!song.favorite);
    favBtn.setAttribute("aria-pressed", String(!!song.favorite));
    favBtn.textContent = song.favorite ? "♥" : "♡";
    favBtn.setAttribute("aria-label", song.favorite ? t("player.unfavorite") : t("player.favorite"));
    renderVariantUI();
    layoutButtons();
  }

  function updateProgressUI(currentTime, duration) {
    const lang = getLang();
    progressFill.style.width = `${duration ? (currentTime / duration) * 100 : 0}%`;
    progressTrack.setAttribute("aria-valuenow", String(duration ? Math.round(currentTime / duration * 100) : 0));
    currentTimeEl.textContent = localizeTime(currentTime, lang);
    remainingTimeEl.textContent = duration ? `-${localizeTime(duration - currentTime, lang)}` : "-0:00";
  }

  function renderShuffleUI() {
    const active = isShuffleOn();
    shuffleBtn.classList.toggle("active", active);
    shuffleBtn.setAttribute("aria-pressed", String(active));
  }

  function renderRepeatUI() {
    const mode = getRepeatMode();
    repeatBtn.classList.toggle("active", mode !== "off");
    repeatBtn.setAttribute("aria-pressed", String(mode !== "off"));
    repeatBtn.setAttribute("aria-label", mode === "one" ? t("player.repeatOne") : mode === "all" ? t("player.repeatAll") : t("player.repeatOff"));
    repeatOneBadge.hidden = mode !== "one";
  }

  function renderVariantUI() {
    const song = getCurrentSong();
    variantBtn.hidden = song?.mediaType === "video" || !getPlayerButtons().variant;
    const available = hasInstrumental(song);
    const variant = getCurrentVariant();
    const { pending } = getVariantStatus();
    variantBtn.textContent = variant === "instrumental" ? t("player.instrumental") : t("player.vocals");
    if (pending) variantBtn.textContent = t("player.variantSwitching");
    variantBtn.setAttribute("aria-busy", String(pending));
    variantBtn.classList.toggle("disabled-hint", !available);
    variantBtn.disabled = !available;
    if (!available) variantBtn.textContent = t("player.noInstrumental");
    variantBtn.setAttribute("aria-label", variantBtn.textContent);
  }

  // ---- open/close ----
  $("#miniExpand").addEventListener("click", open);
  $("#miniExpand").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      if (!morePanel.hidden || !queuePanel.hidden) { dismissMenus(); (moreBtn.hidden ? queueBtn : moreBtn).focus(); reveal(); }
      else close();
    }
  });

  // ---- transport ----
  playBtn.addEventListener("click", togglePlay);
  prevBtn.addEventListener("click", playPrev);
  nextBtn.addEventListener("click", playNext);
  shuffleBtn.addEventListener("click", () => { setShuffle(!isShuffleOn()); renderShuffleUI(); });
  repeatBtn.addEventListener("click", async () => { await cycleRepeatMode(); renderRepeatUI(); });
  favBtn.addEventListener("click", () => { const s = getCurrentSong(); if (s) toggleFavorite(s); });

  on("trackchange", (song) => {
    lastVideoClick=undefined;
    clearTimeout(errorTimer);
    errorToast.classList.remove("visible");
    endDrag({pointerId:dragPointerId});
    dismissMenus();keyboardFocus=false;
    renderSong(song);
    reveal();
    updateProgressUI(audioEl.currentTime, audioEl.duration || song?.duration || 0);
    if (!queuePanel.hidden) renderQueuePanel();
  });
  on("playstate", (isPlaying) => {
    playIcon.innerHTML = isPlaying
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>'
      : '<path d="M8 5v14l11-7z" fill="currentColor"/>';
    playBtn.setAttribute("aria-label", isPlaying ? t("player.pause") : t("player.play"));
  });
  on("timeupdate", (currentTime, duration) => { if (!isDragging) updateProgressUI(currentTime, duration); });
  on("favorite", (song) => { if (getCurrentSong()?.id === song.id) renderSong(song); });
  on("variantchange", renderVariantUI);

  progressTrack.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !audioEl.duration) return;
    event.preventDefault();
    const time = event.key === "Home" ? 0 : event.key === "End" ? audioEl.duration : audioEl.currentTime + (event.key === "ArrowRight" ? 5 : -5);
    seekTo(Math.max(0, Math.min(1, time / audioEl.duration)));
    updateProgressUI(audioEl.currentTime, audioEl.duration);
  });
  // Capture tracks outside the visible bar; only pointerup commits a seek.
  function ratioFromEvent(e) {
    const rect = progressTrack.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX-rect.left)/rect.width));
  }
  progressTrack.addEventListener("pointerdown", (e) => {
    if (isDragging || e.isPrimary === false || e.button !== 0) return;
    e.preventDefault();
    try { progressTrack.setPointerCapture(e.pointerId); } catch { return; }
    isDragging = true;
    dragPointerId = e.pointerId;
    reveal();
    progressTrack.classList.add("dragging");
    const ratio = ratioFromEvent(e);
    if (Number.isFinite(audioEl.duration)) updateProgressUI(ratio * audioEl.duration, audioEl.duration);
  });
  progressTrack.addEventListener("pointermove", (e) => {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    const ratio = ratioFromEvent(e);
    if (Number.isFinite(audioEl.duration)) updateProgressUI(ratio * audioEl.duration, audioEl.duration);
  });
  function endDrag(e) {
    if (!isDragging || e.pointerId !== dragPointerId) return;
    const commit = e.type === 'pointerup';
    isDragging = false;
    dragPointerId = undefined;
    progressTrack.classList.remove("dragging");
    try { progressTrack.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (commit) seekTo(ratioFromEvent(e));
    updateProgressUI(audioEl.currentTime, audioEl.duration);
    reveal();
  }
  progressTrack.addEventListener("pointerup", endDrag);
  progressTrack.addEventListener("pointercancel", endDrag);
  progressTrack.addEventListener("lostpointercapture", endDrag);
  progressTrack.addEventListener("click", e => e.stopPropagation());

  variantBtn.addEventListener("click", async () => {
    if (!hasInstrumental()) return;
    await switchVariant(getVariantStatus().target === "vocals" ? "instrumental" : "vocals");
    renderVariantUI();
  });
  on("songselected", open);
  // ---- queue ----
  queueBtn.addEventListener("click", () => {
    queuePanel.hidden = !queuePanel.hidden;
    if (!queuePanel.hidden) renderQueuePanel();
    reveal();
  });
  function renderQueuePanel() {
    clearNode(queuePanel);
    const queue = getQueue();
    if (!queue.length) {
      queuePanel.appendChild(el("p", { class: "sheet-hint" }, t("player.emptyQueue")));
      return;
    }
    const current = getCurrentSong();
    const list = el("div", { class: "sheet-queue-list" });
    queue.forEach((song) => {
      list.appendChild(createSongRow(song, {
        isPlaying: !!current && current.id === song.id,
        onPlay: (s) => playSong(s, queue),
      }));
    });
    queuePanel.appendChild(list);
  }

  return { open, close };
}
