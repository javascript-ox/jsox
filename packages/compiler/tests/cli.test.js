import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const cli = join(root, "src", "cli.js");

describe("cli", () => {
  it("compiles a file to stdout", () => {
    const dir = mkdtempSync(join(tmpdir(), "jsox-"));
    const src = join(dir, "in.jsox");
    writeFileSync(src, `<div> { ["hi"] }\n`);
    const r = spawnSync(process.execPath, [cli, "compile", src], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /createElement\("div"\)/);
    assert.match(r.stdout, /\$child/);
  });

  it("writes -o output", () => {
    const dir = mkdtempSync(join(tmpdir(), "jsox-"));
    const src = join(dir, "in.jsox");
    const dest = join(dir, "out.js");
    writeFileSync(src, `[obj] { .doThing() }\n`);
    const r = spawnSync(process.execPath, [cli, "compile", src, "-o", dest], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr);
    const out = readFileSync(dest, "utf8");
    assert.match(out, /this\.doThing\(\)/);
    assert.equal(out.includes("function $child"), false);
  });
});
