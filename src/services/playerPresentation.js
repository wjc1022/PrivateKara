// Fullscreen and orientation are separate capabilities. Never rotate HTML to
// imitate a physical display change (in particular, AirPlay screen mirroring).
export function createPlayerPresentation({ element, document, orientation, onChange }) {
  let active = false, entering = false, exiting = false, revision = 0;
  let exitTask = null;
  let mode = 'inline', lock = 'none';
  const snapshot = () => ({ active, pending: entering || exiting, mode, lock });
  const publish = () => onChange(snapshot());
  const unlock = () => { try { orientation?.unlock?.(); } catch {} };
  const exitNative = () => {
    if (exitTask) return exitTask;
    if (document.fullscreenElement !== element) return Promise.resolve();
    exiting = true; publish();
    exitTask = Promise.resolve().then(() => document.exitFullscreen())
      .catch(() => {
        // A refused exit must not advertise an inline state while still native.
        if (document.fullscreenElement === element) {
          active = true; mode = 'native'; lock = 'failed';
        }
      }).finally(() => { exiting = false; exitTask = null; publish(); });
    return exitTask;
  };

  function leave() {
    ++revision;
    active = false; mode = 'inline'; lock = 'none';
    unlock(); publish();
    return exitNative();
  }

  async function enter() {
    // Serialize requests: a late lock/unlock must never affect a newer entry.
    if (active || entering || exiting) return;
    const token = ++revision;
    active = true; entering = true; mode = 'page-fill'; lock = 'pending'; publish();
    try {
      try { await element.requestFullscreen(); } catch { /* Keep HTML lyrics in page fill. */ }
      if (token !== revision) { await exitNative(); return; }
      mode = document.fullscreenElement === element ? 'native' : 'page-fill'; publish();
      if (typeof orientation?.lock !== 'function') lock = 'unsupported';
      else {
        try { await orientation.lock('landscape'); lock = 'locked'; }
        catch { lock = 'failed'; unlock(); }
      }
      if (token !== revision) { unlock(); lock = 'none'; return; }
      publish();
    } finally {
      entering = false; publish();
    }
  }

  function fullscreenChanged() {
    if (document.fullscreenElement === element) {
      if (!active) void exitNative();
      else { mode = 'native'; publish(); }
    } else if (active && mode === 'native') leave();
  }
  return { enter, leave, fullscreenChanged, snapshot };
}
