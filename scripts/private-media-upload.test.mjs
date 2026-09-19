import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(
  new URL("../src/components/private-media-upload.tsx", import.meta.url),
  "utf8",
);
let output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
for (const name of ["react", "react/jsx-runtime"])
  output = output.replaceAll(
    `from "${name}"`,
    `from "${import.meta.resolve(name)}"`,
  );
const languageStub = `data:text/javascript,${encodeURIComponent(
  "export function useLanguage(){return {text:(english)=>english}}",
)}`;
const apiErrorsStub = `data:text/javascript,${encodeURIComponent(
  "export class ApiFailure extends Error{}; export function apiErrorFromPayload(){return new ApiFailure()}; export function presentApiError(){return 'Upload failed.'}",
)}`;
output = output
  .replace('from "@/components/language-provider"', `from "${languageStub}"`)
  .replace('from "@/lib/api-errors"', `from "${apiErrorsStub}"`);
const { PrivateMediaUpload } = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);

test("optional private evidence cannot block its enclosing support form", () => {
  const html = renderToStaticMarkup(
    createElement(
      "form",
      null,
      createElement(PrivateMediaUpload, { onUploaded() {} }),
    ),
  );
  const input = html.match(/<input[^>]+>/)?.[0];
  assert.ok(input);
  assert.match(input, /type="file"/);
  assert.doesNotMatch(input, /\brequired(?:=|\s|>)/);
  assert.match(html, /<button[^>]+type="button"[^>]+disabled/);
});
