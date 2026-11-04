import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareBuild } from '../scripts/prepare-build.mjs';

test('packaging is repeatable; CSS changes alter build and immutable revision without a version bump', async () => {
  const out = await mkdtemp(join(tmpdir(), 'privatekara-package-'));
  const a = await prepareBuild({ out }), again = await prepareBuild({ out });
  assert.equal(a.info.build, again.info.build);
  const css = await readFile(new URL('../src/styles/main.css', import.meta.url), 'utf8');
  const b = await prepareBuild({ out, overrides: { 'src/styles/main.css': css + '\n/* independently generated */' } });
  assert.equal(a.info.version, b.info.version); assert.notEqual(a.info.build, b.info.build);
  assert.notEqual(a.info.sourceRevision, b.info.sourceRevision); assert.equal(b.info.git.dirty, true);
  const module = await readFile(join(out, b.prefix, 'build-info.js'), 'utf8');
  const worker = await readFile(join(out, 'sw.js'), 'utf8');
  assert.ok(module.includes(b.info.build) && worker.includes(b.info.build));
  assert.equal(JSON.parse(await readFile(join(out, 'version.json'))).build, b.info.build);
  assert.ok((await readFile(join(out, 'index.html'), 'utf8')).includes('<base href="./' + b.prefix));
  assert.ok(await readFile(join(out, a.prefix, 'build-info.js')));
});
test('packaging refuses source inputs, unrelated output and altered immutable files', async () => {
  const out = await mkdtemp(join(tmpdir(), 'privatekara-collision-'));
  await writeFile(join(out, 'user-file.txt'), 'preserve');
  await assert.rejects(prepareBuild({ out }), /non-release/);
  assert.equal(await readFile(join(out, 'user-file.txt'), 'utf8'), 'preserve');
  await assert.rejects(prepareBuild({ out: fileURLToPath(new URL('../src', import.meta.url)) }), /source inputs/);
  const managed = await mkdtemp(join(tmpdir(), 'privatekara-immutable-'));
  const a = await prepareBuild({ out: managed });
  await writeFile(join(managed, a.prefix, 'src/styles/main.css'), 'tampered');
  await assert.rejects(prepareBuild({ out: managed }), /Immutable build collision/);
});

async function harness({ latest = { version: '2.2.2', build: 'B' }, fetchError = false, timeout = false, registration, prepared = true } = {}) {
  let stored = { current: { version: '999.0.0', build: 'stale' } }, reloads = 0, requests = 0;
  const current = { version: '2.2.2', build: 'A', prepared };
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
    '../../build-info.js': moduleFor({ buildInfo: current, deploymentRoot: new URL('https://test.invalid/app/') }),
  };
  const source = new vm.SourceTextModule(await readFile(new URL('../src/services/updateService.js', import.meta.url), 'utf8'), { context });
  await source.link(specifier => dependencies[specifier]); await source.evaluate();
  return { api: source.namespace, current, latest, navigator, serviceWorker, reloads: () => reloads, requests: () => requests, setStored(value) { stored = value; } };
}
test('cached database current cannot relabel loaded code; same-version new build is an update', async () => {
  const h = await harness(); const result = await h.api.checkForUpdate({ force: true });
  assert.equal(result.current, h.current); assert.equal(result.latest.build, 'B'); assert.equal(result.available, true);
  await h.api.dismissVersion('B'); assert.equal((await h.api.checkForUpdate()).reason, 'dismissed');
  h.setStored({ latest: { version: '2.2.2', build: 'C' }, lastCheckedAt: Date.now(), dismissedVersion: 'B' });
  assert.equal((await h.api.checkForUpdate()).available, true);
});
test('current build remains module A even when cached latest was checked by another release', async () => {
  const h = await harness(); h.setStored({ current: { version: '999' }, latest: { version: '2.2.2', build: 'A' }, lastCheckedAt: Date.now() });
  const result = await h.api.checkForUpdate(); assert.equal(result.current.build, 'A'); assert.equal(result.available, false); assert.equal(h.requests(), 0);
});
test('unreachable/offline/source-preview checks never impersonate a latest build', async () => {
  const failed = await harness({ fetchError: true });
  assert.equal((await failed.api.checkForUpdate({ force: true })).reason, 'unreachable');
  failed.navigator.onLine = false;
  const result = await failed.api.checkForUpdate(); assert.equal(result.current.build, 'A'); assert.equal(result.latest, undefined);
  const raw = await harness({ prepared: false }); assert.equal((await raw.api.checkForUpdate()).reason, 'unprepared'); assert.equal(raw.requests(), 0);
});
test('older server semantic version does not prompt a downgrade', async () => {
  const h = await harness({ latest: { version: '2.2.1', build: 'older' } });
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
