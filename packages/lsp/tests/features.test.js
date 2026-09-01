import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJsoxSession } from "../src/features.js";

describe("jsox session", () => {
  it("hovers a tag capture as HTMLButtonElement", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-view.jsox";
    const source = `export function view() {
  const el = <button> {
    .type = "button"
  }
  return el;
}
`;
    session.upsert(file, source);
    const hover = session.hover(file, source.indexOf("el"));
    assert.ok(hover);
    assert.match(hover.text, /HTMLButtonElement/);
  });

  it("completes this-shorthand and unclosed blocks", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-dot.jsox";
    const source = `export function view() {
  const el = <button> {
    .
`;
    session.upsert(file, source);
    const items = session.completions(file, source.lastIndexOf(".") + 1, source);
    const labels = new Set(items.map((i) => i.label));
    assert.ok(labels.has("className") || labels.has("addEventListener"));
  });

  it("finds a same-file definition", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-def.jsox";
    const source = `export function view() {
  const el = <button> {
    .type = "button"
  }
  return el;
}
`;
    session.upsert(file, source);
    const defs = session.definition(file, source.lastIndexOf("el"));
    assert.ok(defs.length);
    assert.equal(defs[0].sameFile, true);
    assert.ok(defs[0].origStart <= source.indexOf("el"));
  });

  it("resolves and navigates to an unopened jsox import", async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "jsox-import-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const dependency = join(dir, "view.jsox");
    const importer = join(dir, "main.jsox");
    const dependencySource = `export function Counter() { return <button>; }\n`;
    const importerSource = `import { Counter } from "./view.jsox";\nCounter();\n`;
    await writeFile(dependency, dependencySource);

    const session = createJsoxSession();
    session.upsert(importer, importerSource);

    assert.deepEqual(session.diagnostics(importer), []);
    const defs = session.definition(importer, importerSource.lastIndexOf("Counter"));
    assert.equal(defs.length, 1);
    assert.equal(defs[0].sameFile, false);
    assert.equal(defs[0].fileName, dependency);
    assert.deepEqual(defs[0].start, { line: 0, character: 16 });
  });
});
