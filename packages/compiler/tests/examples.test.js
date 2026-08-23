import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, EL, SCOPE } from "../src/compile.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, "..", "..", "..", "examples");

function exampleMains() {
  return readdirSync(examplesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      file: join(examplesDir, d.name, "src", "main.jsox"),
    }));
}

describe("example packages", () => {
  for (const example of exampleMains()) {
    it(`compiles ${example.name}`, () => {
      const source = readFileSync(example.file, "utf8");
      const { code } = compile(source);
      assert.equal(code.includes(EL), false);
      assert.equal(code.includes(SCOPE), false);
      assert.match(code, /createElement/);
    });
  }
});
