import { readFile } from "node:fs/promises";
import ts from "typescript";
const cache = new Map();
async function moduleUrl(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const source = await readFile(url, "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const specifiers = [...output.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1],
  );
  for (const specifier of specifiers) {
    if (!specifier.startsWith("@/")) continue;
    const dependency = new URL(
      "../src/" + specifier.slice(2) + ".ts",
      import.meta.url,
    );
    output = output.replaceAll(
      JSON.stringify(specifier),
      JSON.stringify(await moduleUrl(dependency)),
    );
  }
  const result =
    "data:text/javascript;base64," + Buffer.from(output).toString("base64");
  cache.set(url.href, result);
  return result;
}
export async function loadProduction(url) {
  return import(await moduleUrl(url));
}
