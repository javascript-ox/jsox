import { describe, it } from "node:test";
import assert from "node:assert/strict";
import jsox from "../src/vite-plugin.js";

describe("Vite plugin", () => {
  it("leaves raw JSOX imports for Vite to stringify", () => {
    assert.equal(jsox().transform("<button>", "/example/view.jsox?raw"), null);
  });

  it("still compiles ordinary JSOX modules", () => {
    const result = jsox().transform("export const button = <button>", "/example/view.jsox");
    assert.match(result.code, /document\.createElement\("button"\)/);
  });
});
