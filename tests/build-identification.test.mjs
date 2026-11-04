import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

async function harness({ latest = { version: '2.2.2', build: 42 }, fetchError = false, timeout = false, registration } = {}) {
  let stored = { current: { version: '999.0.0', build: 'stale' } }, reloads = 0, requests = 0;
  const current = { version: '2.2.2', build: 41 };
  const serviceWorker = new EventTarget(); serviceWorker.getRegistration = async () => registration;
  const navigator = { onLine: true, serviceWorker };
  const context = vm.createContext({ console, URL, navigator, location: { reload() { reloads++; } },
    setTimeout(fn) { if (timeout) queueMicrotask(fn); return 1; }, clearTimeout() {},
    fetch: async () => { requests++; if (fetchError) throw Error('offline'); return { ok: true, json: async () => latest }; },
  });
  const moduleFor = values => new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  const dependencies = {
    '../database/db.js': moduleFor({ Settings: { get: async () => stored, set: async (_key, value) => { stored = value; } } }),
    '../utils/semver.js': new vm.SourceTextModule(await readFile(new URL('../src/utils/semver.js', import.meta.url), 'utf8'), { context }),
    './versionService.js': moduleFor({ buildInfo: current, deploymentRoot: new URL('https://test.invalid/app/'), validVersion: info => typeof info?.version === 'string' && Number.isSafeInteger(info.build), workerURL: info => new URL('https://test.invalid/app/sw.js?build='+info.build) }),
  };
  const source = new vm.SourceTextModule(await readFile(new URL('../src/services/updateService.js', import.meta.url), 'utf8'), { context });
  await source.link(specifier => dependencies[specifier]); await source.evaluate();
  return { api: source.namespace, current, latest, navigator, serviceWorker, reloads: () => reloads, requests: () => requests, setStored(value) { stored = value; } };
}
test('cached database current cannot relabel loaded code; same-version new build is an update', async () => {
  const h = await harness(); const result = await h.api.checkForUpdate({ force: true });
  assert.equal(result.current, h.current); assert.equal(result.latest.build, 42); assert.equal(result.available, true);
  await h.api.dismissVersion('2.2.2+42'); assert.equal((await h.api.checkForUpdate()).reason, 'dismissed');
  h.setStored({ latest: { version: '2.2.2', build: 43 }, lastCheckedAt: Date.now(), dismissedVersion: '2.2.2+42' });
  assert.equal((await h.api.checkForUpdate()).available, true);
});
test('current build remains module A even when cached latest was checked by another release', async () => {
  const h = await harness(); h.setStored({ current: { version: '999' }, latest: { version: '2.2.2', build: 41 }, lastCheckedAt: Date.now() });
  const result = await h.api.checkForUpdate(); assert.equal(result.current.build, 41); assert.equal(result.available, false); assert.equal(h.requests(), 0);
});
test('unreachable/offline checks never impersonate a latest build', async () => {
  const failed = await harness({ fetchError: true });
  assert.equal((await failed.api.checkForUpdate({ force: true })).reason, 'unreachable');
  failed.navigator.onLine = false;
  const result = await failed.api.checkForUpdate(); assert.equal(result.current.build, 41); assert.equal(result.latest, undefined);
});
test('older server semantic version does not prompt a downgrade', async () => {
  const h = await harness({ latest: { version: '2.2.1', build: 40 } });
  assert.equal((await h.api.checkForUpdate({ force: true })).available, false);
});
test('already-installed waiting worker receives SKIP_WAITING immediately and reloads on control change', async () => {
  const worker = new EventTarget(); worker.state = 'installed';
  const registration = new EventTarget(); registration.waiting = worker; registration.update = async () => {};
  const h = await harness({ registration }); const messages = [];
  worker.postMessage = message => { messages.push(message.type); h.serviceWorker.dispatchEvent(new Event('controllerchange')); };
  assert.equal(await h.api.applyUpdateAndReload(), true); assert.deepEqual(messages, ['SKIP_WAITING']); assert.equal(h.reloads(), 1);
});
test('timeout and failed worker update leave old build running without a reload', async () => {
  const registration = new EventTarget(); registration.update = async () => {};
  const h = await harness({ registration, timeout: true });
  assert.equal(await h.api.applyUpdateAndReload(), false); assert.equal(h.reloads(), 0);
  registration.update = async () => { throw Error('network'); };
  const failed = await harness({ registration });
  assert.equal(await failed.api.applyUpdateAndReload(), false); assert.equal(failed.reloads(), 0);
});
test('without a service-worker registration, update reloads normally', async () => {
  const h = await harness(); assert.equal(await h.api.applyUpdateAndReload(), true); assert.equal(h.reloads(), 1);
});
test('registration lookup rejection is reported without throwing or reloading', async () => {
  const h = await harness(); h.serviceWorker.getRegistration = async () => { throw Error('denied'); };
  assert.equal(await h.api.applyUpdateAndReload(), false); assert.equal(h.reloads(), 0);
});

async function versionHarness(info = { version: '2.2.2', build: 41 }) {
  let requests = 0, requested;
  const context = vm.createContext({ URL, fetch: async url => { requests++; requested = url; return { ok: true, json: async () => info }; } });
  const source = new vm.SourceTextModule(await readFile(new URL('../src/services/versionService.js', import.meta.url), 'utf8'), {
    context, initializeImportMeta(meta) { meta.url = 'https://test.invalid/app/src/services/versionService.js'; },
  });
  await source.link(() => {}); await source.evaluate();
  return { api: source.namespace, requests: () => requests, requested: () => requested };
}
test('loaded version is fetched once without latest query and frozen for this page', async () => {
  const info = { version: '2.2.2', build: 41 }, h = await versionHarness(info);
  const a = await h.api.initVersion(); info.build = 42;
  assert.equal(await h.api.initVersion(), a); assert.equal(a.build, 41);
  assert.equal(h.requests(), 1); assert.equal(h.requested().href, 'https://test.invalid/app/version.json');
  assert.equal(Object.isFrozen(a), true);
  assert.equal(h.api.workerURL(a).href, 'https://test.invalid/app/sw.js?build=41');
});
test('invalid manual build metadata cannot label the running application', async () => {
  for (const build of [undefined, 0, -1, '41', 1.5]) {
    const h = await versionHarness({ version: '2.2.2', build });
    await assert.rejects(h.api.initVersion(), /Invalid application version/);
  }
});
test('same-version older build does not prompt a downgrade', async () => {
  const h = await harness({ latest: { version: '2.2.2', build: 40 } });
  assert.equal((await h.api.checkForUpdate({ force: true })).available, false);
});
test('obsolete nonnumeric cached build metadata triggers a fresh server check', async () => {
  const h = await harness();h.setStored({latest:{version:'2.2.3',build:'old-hash'},lastCheckedAt:Date.now()});
  assert.equal((await h.api.checkForUpdate()).latest.build,42);assert.equal(h.requests(),1);
});
