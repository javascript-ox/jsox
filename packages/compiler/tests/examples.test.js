import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, EL, SCOPE } from "../src/compile.js";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, "..", "..", "..", "examples");

function jsoxFiles() {
  const files = [];
  for (const name of readdirSync(examplesDir)) {
    const src = join(examplesDir, name, "src");
    let entries;
    try {
      entries = readdirSync(src);
    } catch {
      continue;
    }
    for (const file of entries) {
      if (!file.endsWith(".jsox")) continue;
      files.push({ name: `${name}/${file}`, file: join(src, file) });
    }
  }
  return files;
}

describe("example packages", () => {
  for (const example of jsoxFiles()) {
    it(`compiles ${example.name}`, () => {
      const source = readFileSync(example.file, "utf8");
      const { code } = compile(source);
      assert.equal(code.includes(EL), false);
      assert.equal(code.includes(SCOPE), false);
    });
  }
});
