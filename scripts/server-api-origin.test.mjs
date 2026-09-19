import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { configuredServerApiOrigin } = await loadProduction(
  new URL("../src/lib/runtime-origin.ts", import.meta.url),
);

test("server API reads default to port 5000 in development", () => {
  assert.equal(
    configuredServerApiOrigin({ NODE_ENV: "development" }),
    "http://localhost:5000",
  );
  assert.equal(
    configuredServerApiOrigin({ NODE_ENV: "production" }),
    "https://api.example.com",
  );
});

test("server API origin accepts an exact override and rejects paths", () => {
  assert.equal(
    configuredServerApiOrigin({ API_ORIGIN: "http://localhost:5555" }),
    "http://localhost:5555",
  );
  assert.throws(
    () => configuredServerApiOrigin({ API_ORIGIN: "http://localhost:5000/path" }),
    /exact origin/i,
  );
});
