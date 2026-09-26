import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const { createActionGate } = await loadProduction(
  new URL("../src/lib/action-gate.ts", import.meta.url),
);
test("a pending action rejects duplicate submissions and releases its controls", async () => {
  let finish;
  let calls = 0;
  const states = [];
  const gate = createActionGate();
  const first = gate.run(
    async () => {
      calls++;
      await new Promise((resolve) => {
        finish = resolve;
      });
    },
    (value) => states.push(value),
  );
  assert.equal(
    await gate.run(
      async () => {
        calls++;
      },
      (value) => states.push(value),
    ),
    false,
  );
  finish();
  assert.equal(await first, true);
  assert.equal(calls, 1);
  assert.deepEqual(states, [true, false]);
});
test("a failed action releases the gate and preserves the original typed failure", async () => {
  const gate = createActionGate();
  const error = new Error("original");
  const states = [];
  await assert.rejects(
    gate.run(
      async () => {
        throw error;
      },
      (value) => states.push(value),
    ),
    (value) => value === error,
  );
  assert.deepEqual(states, [true, false]);
  assert.equal(
    await gate.run(
      async () => {},
      () => {},
    ),
    true,
  );
});
