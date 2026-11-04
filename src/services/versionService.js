// Read the installed shell version once, separately from the latest-server check.
export const deploymentRoot = new URL('../../', import.meta.url);
export let buildInfo;
let loading;
export function validVersion(info) {
  return typeof info?.version === 'string' && /^\d+\.\d+\.\d+$/.test(info.version) && Number.isSafeInteger(info.build) && info.build > 0;
}
export function workerURL(info) {
  const url = new URL('sw.js', deploymentRoot);
  url.searchParams.set('build', String(info.build));
  return url;
}
export function initVersion() {
  return loading ||= fetch(new URL('version.json', deploymentRoot), { cache: 'no-cache' }).then(async response => {
    if (!response.ok) throw Error('Application version unavailable');
    const info = await response.json();
    if (!validVersion(info)) throw Error('Invalid application version');
    return buildInfo = Object.freeze({ version: info.version, build: info.build });
  });
}
