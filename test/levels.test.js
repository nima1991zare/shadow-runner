import test from "node:test";
import assert from "node:assert/strict";
import { generateLevel, getDistrict, TOTAL_LEVELS } from "../src/levels.js";

test("all 1000 levels generate valid deterministic layouts", () => {
  for (let level = 1; level <= TOTAL_LEVELS; level += 1) {
    const first = generateLevel(level);
    const second = generateLevel(level);
    assert.deepEqual(first, second);
    assert.equal(first.level, level);
    assert.equal(first.district, getDistrict(level));
    assert.equal(first.relics.length, 3);
    assert.ok(first.buildings.length >= 10);
    assert.ok(first.parTime >= 34);
    for (const relic of first.relics) {
      assert.ok(first.buildings.every((building) =>
        Math.abs(relic.x - building.x) > building.width / 2 || Math.abs(relic.z - building.z) > building.depth / 2
      ));
    }
  }
});

test("out-of-range level numbers are clamped", () => {
  assert.equal(generateLevel(-5).level, 1);
  assert.equal(generateLevel(5000).level, 1000);
});
