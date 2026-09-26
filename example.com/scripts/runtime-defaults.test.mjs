import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("storefront defaults to port 3030 and links to staff on port 4000", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const switcher = await readFile(
    new URL("../src/components/simulation-switcher.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(packageJson.scripts.dev, "next dev -p 3030");
  assert.equal(packageJson.scripts.start, "next start -p 3030");
  assert.match(switcher, /http:\/\/localhost:4000/);
});

test("storefront development proxies to the local API on port 5000 by default", async () => {
  const source = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const previousApiOrigin = process.env.API_ORIGIN;
  const previousNodeEnvironment = process.env.NODE_ENV;
  delete process.env.API_ORIGIN;
  process.env.NODE_ENV = "development";
  try {
    const config = (
      await import(
        `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#storefront`
      )
    ).default;
    const rewrites = await config.rewrites();
    assert.equal(
      rewrites[0].destination,
      "http://localhost:5000/api/:path*",
    );
  } finally {
    if (previousApiOrigin === undefined) delete process.env.API_ORIGIN;
    else process.env.API_ORIGIN = previousApiOrigin;
    if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnvironment;
  }
});
