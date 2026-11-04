import { Settings } from '../database/db.js';
import { compareVersions } from '../utils/semver.js';
import { buildInfo, deploymentRoot, validVersion, workerURL } from './versionService.js';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SETTINGS_KEY = 'updateCheckV2';
export const buildKey = info => info.version + '+' + info.build;
export async function checkForUpdate({ force = false } = {}) {
  let cached;
  try { cached = await Settings.get(SETTINGS_KEY, null); } catch {}
  if (navigator.onLine === false) return { available: false, current: buildInfo, reason: 'offline' };
  const now = Date.now();
  let stored = cached;
  if (force || !validVersion(cached?.latest) || !cached?.lastCheckedAt || now - cached.lastCheckedAt >= CHECK_INTERVAL_MS) {
    try {
      const url = new URL('version.json', deploymentRoot); url.searchParams.set('t', String(now));
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw Error('Version request failed');
      const latest = await response.json();
      if (!validVersion(latest)) throw Error('Invalid version metadata');
      stored = { latest, lastCheckedAt: now, dismissedVersion: cached?.dismissedVersion };
      try { await Settings.set(SETTINGS_KEY, stored); } catch {}
    } catch { return { available: false, current: buildInfo, reason: 'unreachable' }; }
  }
  const latest = stored?.latest;
  if (!validVersion(latest)) return { available: false, current: buildInfo };
  const comparison = compareVersions(latest.version, buildInfo.version);
  const different = comparison > 0 || (comparison === 0 && Boolean(latest.build) && latest.build > buildInfo.build);
  const dismissed = stored.dismissedVersion === buildKey(latest);
  return { available: different && !dismissed, current: buildInfo, latest, ...(different && dismissed ? { reason: 'dismissed' } : {}) };
}
export async function dismissVersion(identity) {
  let stored; try { stored = await Settings.get(SETTINGS_KEY, null); } catch { return; }
  if (stored) { stored.dismissedVersion = identity; try { await Settings.set(SETTINGS_KEY, stored); } catch {} }
}
export async function applyUpdateAndReload(onStage, latest) {
  if (!('serviceWorker' in navigator)) { location.reload(); return true; }
  let reg;
  try { reg = await navigator.serviceWorker.getRegistration(deploymentRoot.href); }
  catch { onStage?.('timeout'); return false; }
  if (!reg) { location.reload(); return true; }
  onStage?.('checking');
  const activated = await new Promise(resolve => {
    const removers = [];
    let settled = false;
    const listen = (target, event, fn) => { target.addEventListener(event, fn); removers.push(() => target.removeEventListener(event, fn)); };
    const finish = success => { if (settled) return; settled = true; clearTimeout(timer); removers.forEach(remove => remove()); resolve(success); };
    const timer = setTimeout(() => { onStage?.('timeout'); finish(false); }, 12000);
    const observe = worker => {
      if (!worker) return;
      const advance = () => {
        if (worker.state === 'installed') { onStage?.('activating'); worker.postMessage({ type: 'SKIP_WAITING' }); }
        else if (worker.state === 'redundant') { onStage?.('timeout'); finish(false); }
      };
      onStage?.('installing'); listen(worker, 'statechange', advance); advance();
    };
    listen(navigator.serviceWorker, 'controllerchange', () => finish(true));
    listen(reg, 'updatefound', () => observe(reg.installing));
    observe(reg.waiting || reg.installing);
    const update = latest && validVersion(latest)
      ? navigator.serviceWorker.register(workerURL(latest), { scope: deploymentRoot.href, updateViaCache: 'none' })
      : reg.update();
    update.catch(() => { onStage?.('timeout'); finish(false); });
  });
  if (activated) location.reload();
  return activated;
}
