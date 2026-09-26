import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/product-presentation.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { sizeGuideTable } = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);

test("size guides align named measurements across sizes without leaking raw JSON", () => {
  assert.deepEqual(
    sizeGuideTable({
      unit: "cm",
      M: { chest: 98, length: 70 },
      L: { chest: 104 },
    }),
    {
      unit: "cm",
      columns: ["chest", "length"],
      rows: [
        { size: "M", values: ["98", "70"] },
        { size: "L", values: ["104", "—"] },
      ],
    },
  );
});
test("legacy flat guides and empty guides remain readable", () => {
  assert.deepEqual(sizeGuideTable({ S: "Small", M: 98 }), {
    unit: null,
    columns: ["Measurement"],
    rows: [
      { size: "S", values: ["Small"] },
      { size: "M", values: ["98"] },
    ],
  });
  assert.deepEqual(sizeGuideTable({ unit: "cm" }), {
    unit: "cm",
    columns: [],
    rows: [],
  });
});

test("standard clothing sizes use fit order rather than JSONB alphabetical order", () => {
  assert.deepEqual(
    sizeGuideTable({
      L: { Chest: 104 },
      XS: { Chest: 86 },
      M: { Chest: 98 },
      S: { Chest: 92 },
      XL: { Chest: 110 },
    }).rows.map((row) => row.size),
    ["XS", "S", "M", "L", "XL"],
  );
});
