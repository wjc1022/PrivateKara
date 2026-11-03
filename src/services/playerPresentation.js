// Viewport orientation, native fullscreen and receiver output are independent.
// Enter preserves orientation; only explicit user intent may request a lock.
export function createPlayerPresentation({ element, document, orientation, isLandscape = () => false, onChange }) {
  let active = false, entering = false, locking = false, exiting = false;
  let revision = 0, ownsLock = false, exitTask = null;
  let mode = 'inline', lock = 'none';
  const snapshot = () => ({ active, pending: entering || locking || exiting, mode, lock });
  const publish = () => onChange(snapshot());
  function releaseOwnedLock() {
    if (!ownsLock) return true;
    try { orientation.unlock(); ownsLock = false; return true; }
    catch { return false; /* Retain ownership so an explicit release can retry. */ }
  }
  function exitNative() {
    if (exitTask) return exitTask;
    if (document.fullscreenElement !== element) return Promise.resolve();
    exiting = true; publish();
    exitTask = Promise.resolve().then(() => document.exitFullscreen()).catch(() => {
      if (document.fullscreenElement === element) { active = true; mode = 'native'; }
    }).finally(() => { exiting = false; exitTask = null; publish(); });
    return exitTask;
  }
  function leave() {
    ++revision; active = false; mode = 'inline'; lock = 'none';
    releaseOwnedLock(); publish();
    return exitNative();
  }
  async function enter() {
    if (active || entering || locking || exiting) return;
    const token = ++revision;
    active = true; entering = true; mode = 'page-fill'; lock = 'none'; publish();
    try {
      try { await element.requestFullscreen(); } catch { /* Upright page fill keeps HTML lyrics. */ }
      if (token !== revision) { await exitNative(); return; }
      mode = document.fullscreenElement === element ? 'native' : 'page-fill';
    } finally { entering = false; publish(); }
  }
  async function requestLandscape() {
    // No device guessing, automatic retry, or lock attempt in page fill.
    if (!active || entering || locking || exiting || document.fullscreenElement !== element || lock !== 'none' || isLandscape()) return;
    if (typeof orientation?.lock !== 'function') { lock = 'unsupported'; publish(); return; }
    const token = revision;
    locking = true; lock = 'pending'; publish();
    try {
      await orientation.lock('landscape'); ownsLock = true;
      if (token !== revision || document.fullscreenElement !== element) {
        releaseOwnedLock(); lock = 'none'; return;
      }
      lock = 'locked';
    } catch {
      lock = token === revision ? 'failed' : 'none';
    } finally { locking = false; publish(); }
  }
  function followDevice() {
    if (locking || !ownsLock) return;
    if (releaseOwnedLock()) lock = 'none';
    publish();
  }
  function fullscreenChanged() {
    if (document.fullscreenElement === element) {
      if (!active) void exitNative();
      else { mode = 'native'; publish(); }
    } else if (active && mode === 'native') void leave();
  }
  return { enter, leave, requestLandscape, followDevice, fullscreenChanged, snapshot };
}
