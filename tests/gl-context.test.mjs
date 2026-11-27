// gl-context.js: a refused WebGL context is asked again with less before the player sees a message.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contextAttempts, createWithFallback } from '../src/gl-context.js';

const want = { antialias: true, powerPreference: 'high-performance', reversedDepthBuffer: true, logarithmicDepthBuffer: false };

test('each step asks for less than the one before', () => {
  const steps = contextAttempts(want);
  assert.equal(steps[0], want);
  assert.ok(!('powerPreference' in steps[1]));
  assert.equal(steps.at(-1).antialias, false);
  assert.equal(steps.at(-1).reversedDepthBuffer, false);
});
test('a browser that refuses the full ask but takes a plain one still starts', () => {
  const got = createWithFallback((o) => { if (o.powerPreference || o.reversedDepthBuffer) throw new Error('Error creating WebGL context.'); return { ok: o }; }, want);
  assert.equal(got.tried, 2);
  assert.equal(got.renderer.ok.antialias, true);
});
test('a browser with no graphics at all throws the last error', () => {
  assert.throws(() => createWithFallback(() => { throw new Error('Error creating WebGL context.'); }, want), /WebGL context/);
});
