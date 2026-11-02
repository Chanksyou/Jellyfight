import test from 'node:test';
import assert from 'node:assert/strict';
import { RunLog } from '../src/run-log.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const summary = (extra = {}) => ({ run: 'run-abcdefgh', act: 1, outcome: 'started', revision: Date.now(), ...extra });
function setup(t, send = async () => Response.json({ saved: true })) {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: key => storage[key] || null },
    setItem: { configurable: true, value: (key, value) => { storage[key] = value; } },
    removeItem: { value: key => { delete storage[key]; } },
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage; });
  const timers = [];
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => { timers.push({ fn, delay }); return timers.length; });
  const fetch = t.mock.method(globalThis, 'fetch', send);
  return { storage, timers, fetch };
}

test('failed uploads survive a reload, batch pending acts, and clear only after acknowledgement', async t => {
  const { storage, timers, fetch } = setup(t, async () => { throw new Error('offline'); });
  const log = new RunLog('player-one');
  log.save(summary());
  log.save(summary({ act: 2 }));
  await tick();
  assert.equal(Object.keys(storage).length, 2);
  assert.equal(timers.length, 1);
  assert.ok(timers[0].delay >= 10000);
  fetch.mock.mockImplementation(async () => Response.json({ saved: true }));
  const restored = new RunLog('player-one');
  await restored.flush();
  assert.equal(JSON.parse(fetch.mock.calls.at(-1).arguments[1].body).rows.length, 2);
  assert.equal(Object.keys(storage).length, 0);
});

test('an in-flight acknowledgement cannot discard a newer final checkpoint', async t => {
  let resolve;
  const { storage } = setup(t, () => new Promise(r => { resolve = r; }));
  const log = new RunLog('player-one'), revision = Date.now();
  log.save(summary({ revision }));
  log.save(summary({ revision: revision + 1, outcome: 'died' }));
  log.save(summary({ revision: revision + 2, outcome: 'in-progress' }));
  resolve(Response.json({ saved: true }));
  await tick();
  assert.equal(log.pending.size, 1);
  assert.equal(JSON.parse(Object.values(storage)[0]).outcome, 'died');
});

test('a second tab cannot overwrite a persisted final with an unfinished checkpoint', async t => {
  const { storage } = setup(t, async () => { throw new Error('offline'); });
  const first = new RunLog('player-one'), second = new RunLog('player-one'), revision = Date.now();
  first.save(summary({ revision, outcome: 'died' }));
  second.save(summary({ revision: revision + 1, outcome: 'in-progress' }));
  await tick();
  assert.equal(JSON.parse(Object.values(storage)[0]).outcome, 'died');
  assert.equal([...second.pending.values()][0].outcome, 'died');
});

test('an acknowledgement preserves another tab final with the same millisecond revision', async t => {
  let resolve;
  const { storage } = setup(t, () => new Promise(r => { resolve = r; }));
  const first = new RunLog('player-one'), second = new RunLog('player-one'), revision = Date.now();
  first.save(summary({ revision }));
  second.busy = true;
  second.save(summary({ revision, outcome: 'died' }));
  resolve(Response.json({ saved: true }));
  await tick();
  assert.equal(JSON.parse(Object.values(storage)[0]).outcome, 'died');
});

test('rate limits retain reports, back off, and the offline queue stays bounded and expires', async t => {
  const { storage, timers } = setup(t, async () => Response.json({ saved: false }, { status: 429 }));
  const log = new RunLog('player-one');
  for (let i = 0; i < 40; i++) log.save(summary({ run: 'run-number-' + i }));
  await tick();
  assert.equal(log.pending.size, 32);
  assert.equal(Object.keys(storage).length, 32);
  assert.ok(timers[0].delay >= 10000);
  storage['jellyrun.log:player-one:old:1'] = JSON.stringify(summary({ revision: Date.now() - 8 * 86400000 }));
  assert.equal(new RunLog('player-one').pending.size, 32);
  assert.equal(storage['jellyrun.log:player-one:old:1'], undefined);
});

test('batches stay below keepalive size and unavailable storage does not interrupt uploads', async t => {
  const { storage, fetch } = setup(t);
  const log = new RunLog('player-one');
  log.busy = true;
  for (let i = 0; i < 12; i++) log.save(summary({ run: 'run-number-' + i, extra: 'x'.repeat(7000) }));
  log.busy = false;
  await log.flush();
  const body = fetch.mock.calls[0].arguments[1].body;
  assert.ok(new TextEncoder().encode(body).length <= 48000);
  assert.ok(JSON.parse(body).rows.length <= 8);
  Object.defineProperty(storage, 'setItem', { configurable: true, value: () => { throw new Error('blocked'); } });
  const memoryOnly = new RunLog('player-two');
  memoryOnly.save(summary());
  await tick();
  assert.equal(memoryOnly.pending.size, 0);
});

test('larger choice histories remain deliverable within the batch byte limit', async t => {
  const { fetch } = setup(t);
  const log = new RunLog('player-one');
  log.save(summary({ details: { pickups: Array.from({ length: 128 }, (_, n) => ['treasure-with-a-long-identifier', n * 15, 3]) },
    extra: 'x'.repeat(12000) }));
  await tick();
  assert.equal(fetch.mock.calls.length, 1);
  assert.ok(new TextEncoder().encode(fetch.mock.calls[0].arguments[1].body).length < 48000);
  assert.equal(log.pending.size, 0);
});
