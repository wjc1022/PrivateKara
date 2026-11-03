import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/services/playerPresentation.js', import.meta.url), 'utf8');
const { createPlayerPresentation } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ native = true, lock = async () => {}, exit } = {}) {
  const calls = [], states = [];
  const document = { fullscreenElement: null, async exitFullscreen() { calls.push('exit'); if (exit) await exit(); document.fullscreenElement = null; } };
  const element = { async requestFullscreen() { calls.push('request'); if (!native) throw Error('denied'); document.fullscreenElement = element; } };
  const orientation = { unlock() { calls.push('unlock'); }, ...(lock ? { lock(value) { calls.push(value); return lock(); } } : {}) };
  const controller = createPlayerPresentation({ element, document, orientation, onChange: state => states.push(state) });
  return { controller, element, document, calls, states };
}

test('native entry requests landscape after fullscreen and native exit releases lock', async () => {
  const { controller: c, document: d, calls } = setup();
  await c.enter();
  assert.deepEqual(calls, ['request', 'landscape']);
  assert.deepEqual(c.snapshot(), { active: true, pending: false, mode: 'native', lock: 'locked' });
  d.fullscreenElement = null; c.fullscreenChanged();
  assert.equal(c.snapshot().active, false); assert.equal(calls.at(-1), 'unlock');
});

test('denied or missing native fullscreen keeps an honest page-fill state', async () => {
  for (const missing of [false, true]) {
    const { controller: c, element } = setup({ native: false, lock: null });
    if (missing) delete element.requestFullscreen;
    await c.enter();
    assert.equal(c.snapshot().mode, 'page-fill'); assert.equal(c.snapshot().lock, 'unsupported');
    c.leave(); assert.equal(c.snapshot().mode, 'inline');
  }
});

test('lock rejection is explicit, releases lock and retains native fullscreen', async () => {
  const { controller: c, calls } = setup({ lock: async () => { throw Error('not supported'); } });
  await c.enter();
  assert.equal(c.snapshot().lock, 'failed'); assert.equal(c.snapshot().mode, 'native');
  assert.equal(calls.at(-1), 'unlock');
});

test('synchronous API exceptions degrade safely', async () => {
  const { controller: c, element } = setup({ lock() { throw Error('lock failed'); } });
  element.requestFullscreen = () => { throw Error('blocked'); };
  await c.enter(); assert.equal(c.snapshot().mode, 'page-fill'); assert.equal(c.snapshot().lock, 'failed');
});

test('exit while fullscreen is pending cancels late entry and permits retry', async () => {
  const { controller: c, element, document: d, calls } = setup();
  const request = deferred(); element.requestFullscreen = () => request.promise;
  const entry = c.enter(); c.leave(); await c.enter(); // serialized until old request settles
  d.fullscreenElement = element; request.resolve(); await entry;
  assert.equal(d.fullscreenElement, null); assert.equal(c.snapshot().active, false);
  assert.ok(!calls.includes('landscape'));
  element.requestFullscreen = async () => { d.fullscreenElement = element; };
  await c.enter(); assert.equal(c.snapshot().lock, 'locked');
});

test('late successful orientation lock is unlocked after close and cannot revive state', async () => {
  const request = deferred(); const { controller: c, calls } = setup({ lock: () => request.promise });
  const entry = c.enter(); await tick(); const leaving = c.leave();
  request.resolve(); await entry; await leaving;
  assert.deepEqual(c.snapshot(), { active: false, pending: false, mode: 'inline', lock: 'none' });
  assert.equal(calls.at(-1), 'unlock');
});

test('native exit while orientation lock is pending cancels late failure', async () => {
  const request = deferred(); const { controller: c, document: d } = setup({ lock: () => request.promise });
  const entry = c.enter(); await tick(); d.fullscreenElement = null; c.fullscreenChanged();
  request.reject(Error('cancelled')); await entry;
  assert.deepEqual(c.snapshot(), { active: false, pending: false, mode: 'inline', lock: 'none' });
});

test('repeated entry and leave remain consistent and do not duplicate active requests', async () => {
  const { controller: c, calls, document: d } = setup();
  for (let i = 0; i < 3; i++) {
    await c.enter(); await c.enter(); c.leave(); await tick();
    assert.equal(c.snapshot().mode, 'inline'); assert.equal(d.fullscreenElement, null);
  }
  assert.equal(calls.filter(c => c === 'request').length, 3);
});

test('failed browser exit retains an honest native state and the next leave retries', async () => {
  let fail = true;
  const { controller: c, document: d, element } = setup({ exit: async () => { if (fail) throw Error('denied'); } });
  await c.enter(); c.leave(); await tick();
  assert.equal(c.snapshot().mode, 'native'); assert.equal(c.snapshot().active, true);
  assert.equal(d.fullscreenElement, element);
  fail = false; c.leave(); await tick(); assert.equal(d.fullscreenElement, null);
});

test('new entry waits for an outstanding native exit', async () => {
  const exit = deferred(); const { controller: c, calls } = setup({ exit: () => exit.promise });
  await c.enter(); c.leave(); await c.enter();
  assert.equal(calls.filter(c => c === 'request').length, 1);
  exit.resolve(); await tick(); await c.enter();
  assert.equal(calls.filter(c => c === 'request').length, 2);
});

test('repeated leave shares the outstanding exit and preserves refusal state', async () => {
  const exit = deferred(); const { controller: c } = setup({ exit: () => exit.promise });
  await c.enter(); const first = c.leave(), second = c.leave();
  assert.equal(first, second);
  exit.reject(Error('refused')); await second;
  assert.equal(c.snapshot().mode, 'native'); assert.equal(c.snapshot().active, true);
});

test('cleanup never exits another element fullscreen and absent orientation is safe', async () => {
  const element = {}, document = { fullscreenElement: {} };
  const c = createPlayerPresentation({ element, document, onChange() {} });
  await c.enter(); assert.equal(c.snapshot().lock, 'unsupported');
  c.leave(); assert.ok(document.fullscreenElement);
});
