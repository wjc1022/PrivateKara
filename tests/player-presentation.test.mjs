import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/services/playerPresentation.js', import.meta.url), 'utf8');
const { createPlayerPresentation } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ native = true, lock = async () => {}, exit, landscape = false } = {}) {
  const calls = [], states = [];
  const view = { landscape };
  const document = { fullscreenElement: null, async exitFullscreen() { calls.push('exit'); if (exit) await exit(); document.fullscreenElement = null; } };
  const element = { async requestFullscreen() { calls.push('request'); if (!native) throw Error('denied'); document.fullscreenElement = element; } };
  const orientation = { unlock() { calls.push('unlock'); }, ...(lock ? { lock(value) { calls.push(value); return lock(); } } : {}) };
  const controller = createPlayerPresentation({ element, document, orientation, isLandscape: () => view.landscape, onChange: state => states.push(state) });
  return { c: controller, element, document, orientation, calls, states, view };
}

test('native fullscreen preserves current orientation and never unlocks an unrelated lock', async () => {
  for (const landscape of [false, true]) {
    const { c, document: d, calls } = setup({ landscape }); await c.enter();
    assert.deepEqual(calls, ['request']);
    assert.deepEqual(c.snapshot(), { active: true, pending: false, mode: 'native', lock: 'none' });
    d.fullscreenElement = null; c.fullscreenChanged();
    assert.equal(c.snapshot().active, false); assert.ok(!calls.includes('unlock'));
  }
});
test('explicit landscape request locks once in native fullscreen and exit releases only owned lock', async () => {
  const { c, calls } = setup(); await c.enter(); await c.requestLandscape(); await c.requestLandscape();
  assert.deepEqual(calls, ['request', 'landscape']); assert.equal(c.snapshot().lock, 'locked');
  await c.leave(); assert.equal(calls.filter(c => c === 'unlock').length, 1);
});
test('already landscape viewport never requests another orientation lock', async () => {
  const { c, calls } = setup({ landscape: true }); await c.enter(); await c.requestLandscape();
  assert.deepEqual(calls, ['request']); assert.equal(c.snapshot().lock, 'none');
});
test('manual portrait/landscape changes do not trigger locking or automatic retry', async () => {
  const { c, view, calls } = setup(); await c.enter();
  for (const landscape of [true, false, true, false]) { view.landscape = landscape; c.fullscreenChanged(); }
  assert.deepEqual(calls, ['request']); assert.equal(c.snapshot().mode, 'native');
});
test('denied and missing native fullscreen keep page fill and never attempt a lock', async () => {
  for (const missing of [false, true]) {
    const { c, element, calls } = setup({ native: false }); if (missing) delete element.requestFullscreen;
    await c.enter(); await c.requestLandscape();
    assert.equal(c.snapshot().mode, 'page-fill'); assert.equal(c.snapshot().lock, 'none');
    await c.leave(); assert.ok(!calls.includes('landscape')); assert.ok(!calls.includes('unlock'));
  }
});
test('missing lock method is explicit only when requested in native fullscreen', async () => {
  const { c, calls } = setup({ lock: null }); await c.enter(); await c.requestLandscape();
  assert.equal(c.snapshot().lock, 'unsupported'); await c.leave(); assert.ok(!calls.includes('unlock'));
});
test('lock rejection is explicit and never unlocks an unrelated orientation state', async () => {
  const { c, calls } = setup({ lock: async () => { throw Error('not supported'); } });
  await c.enter(); await c.requestLandscape(); await c.requestLandscape();
  assert.equal(c.snapshot().lock, 'failed'); assert.equal(c.snapshot().mode, 'native');
  assert.equal(calls.filter(c => c === 'landscape').length, 1); assert.ok(!calls.includes('unlock'));
});
test('synchronous fullscreen and lock exceptions degrade safely', async () => {
  const { c, element } = setup(); element.requestFullscreen = () => { throw Error('blocked'); };
  await c.enter(); assert.equal(c.snapshot().mode, 'page-fill');
  const other = setup({ lock() { throw Error('blocked'); } });
  await other.c.enter(); await other.c.requestLandscape(); assert.equal(other.c.snapshot().lock, 'failed');
});
test('close during pending fullscreen cancels late success and permits retry', async () => {
  const { c, element, document: d, calls } = setup(); const pending = deferred();
  element.requestFullscreen = () => pending.promise;
  const entry = c.enter(); await c.leave(); await c.enter();
  d.fullscreenElement = element; pending.resolve(); await entry;
  assert.equal(d.fullscreenElement, null); assert.equal(c.snapshot().active, false); assert.ok(!calls.includes('landscape'));
  element.requestFullscreen = async () => { d.fullscreenElement = element; };
  await c.enter(); assert.equal(c.snapshot().mode, 'native');
});
test('late fullscreen rejection cannot restore a closed player', async () => {
  const { c, element } = setup(); const pending = deferred(); element.requestFullscreen = () => pending.promise;
  const entry = c.enter(); await c.leave(); pending.reject(Error('denied')); await entry;
  assert.deepEqual(c.snapshot(), { active: false, pending: false, mode: 'inline', lock: 'none' });
});
test('late lock success is released after close without reviving state', async () => {
  const pending = deferred(), { c, calls } = setup({ lock: () => pending.promise });
  await c.enter(); const locking = c.requestLandscape(); const leaving = c.leave(); await c.enter();
  pending.resolve(); await locking; await leaving;
  assert.deepEqual(c.snapshot(), { active: false, pending: false, mode: 'inline', lock: 'none' });
  assert.equal(calls.filter(c => c === 'unlock').length, 1);
});
test('native exit cancels pending lock failure without an unrelated unlock', async () => {
  const pending = deferred(), { c, document: d, calls } = setup({ lock: () => pending.promise });
  await c.enter(); const locking = c.requestLandscape(); d.fullscreenElement = null; c.fullscreenChanged();
  pending.reject(Error('cancelled')); await locking;
  assert.equal(c.snapshot().mode, 'inline'); assert.equal(c.snapshot().lock, 'none'); assert.ok(!calls.includes('unlock'));
});
test('native exit releases a successfully owned lock', async () => {
  const { c, document: d, calls } = setup(); await c.enter(); await c.requestLandscape();
  d.fullscreenElement = null; c.fullscreenChanged(); await tick();
  assert.equal(c.snapshot().active, false); assert.equal(calls.filter(c => c === 'unlock').length, 1);
});
test('follow device releases owned lock and remains native fullscreen', async () => {
  const { c, calls } = setup(); c.followDevice(); assert.deepEqual(calls, []);
  await c.enter(); await c.requestLandscape(); c.followDevice(); c.followDevice();
  assert.equal(c.snapshot().mode, 'native'); assert.equal(c.snapshot().lock, 'none');
  assert.equal(calls.filter(c => c === 'unlock').length, 1);
});
test('repeat entry/exit and rapid active entry do not duplicate native requests', async () => {
  const { c, calls } = setup();
  for (let i = 0; i < 3; i++) { await c.enter(); await c.enter(); await c.leave(); }
  assert.equal(calls.filter(c => c === 'request').length, 3); assert.equal(c.snapshot().mode, 'inline');
});
test('failed explicit unlock does not claim success and a user retry releases the owned lock', async () => {
  const { c, orientation } = setup(); let attempts = 0;
  orientation.unlock = () => { if (++attempts === 1) throw Error('temporarily denied'); };
  await c.enter(); await c.requestLandscape(); c.followDevice();
  assert.equal(c.snapshot().lock, 'locked');
  c.followDevice(); assert.equal(c.snapshot().lock, 'none'); assert.equal(attempts, 2);
});
test('refused exit retains actual native state and next leave retries', async () => {
  let fail = true; const { c, document: d } = setup({ exit: async () => { if (fail) throw Error('denied'); } });
  await c.enter(); await c.leave(); assert.equal(c.snapshot().mode, 'native'); assert.equal(c.snapshot().active, true);
  fail = false; await c.leave(); assert.equal(d.fullscreenElement, null); assert.equal(c.snapshot().mode, 'inline');
});
test('repeated exit shares pending operation and blocks new entry', async () => {
  const pending = deferred(), { c, calls } = setup({ exit: () => pending.promise });
  await c.enter(); const first = c.leave(), second = c.leave(); assert.equal(first, second); await c.enter();
  assert.equal(calls.filter(c => c === 'request').length, 1); pending.resolve(); await first;
  await c.enter(); assert.equal(calls.filter(c => c === 'request').length, 2);
});
test('cleanup never exits another element fullscreen and absent APIs are safe', async () => {
  const document = { fullscreenElement: {} }; const c = createPlayerPresentation({ element: {}, document, onChange() {} });
  await c.enter(); await c.requestLandscape(); await c.leave(); assert.ok(document.fullscreenElement);
});
