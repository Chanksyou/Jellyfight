import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seededRandom, seedFor } from '../src/story-random.mjs';

test('same story and seed replay the same random sequence', () => {
  const samples = (name, seed) => {
    const random = seededRandom(seedFor(name, seed));
    return Array.from({ length: 1000 }, random);
  };
  assert.deepEqual(samples('beetles', 42), samples('beetles', 42));
  assert.notDeepEqual(samples('beetles', 42), samples('beetles', 43));
  assert.notDeepEqual(samples('beetles', 42), samples('treasures', 42));
  assert(samples('beetles', 0).every(n => n >= 0 && n < 1));
});
