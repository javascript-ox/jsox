import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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
    assert.ok(labels.has("className"));
  });

  it("completes a newly inserted shorthand inside a completed block", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-inserted-dot.jsox";
    const source = `const el = <div> {
  .
  .style = {}
}`;
    session.upsert(file, source);
    const items = session.completions(file, source.indexOf(".\n") + 1, source);
    const labels = new Set(items.map((item) => item.label));
    assert.ok(labels.has("className"));
    assert.ok(labels.has("style"));
    assert.ok(labels.has("click"));
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

  it("navigates from an HTML tag to its DOM element type", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-tag-definition.jsox";
    const source = `const el = <div> { .className = "card" };`;
    session.upsert(file, source);

    const defs = session.definition(file, source.indexOf("div") + 1);
    assert.ok(defs.length);
    assert.equal(defs[0].sameFile, false);
    assert.match(defs[0].fileName, /lib\.dom\.d\.ts$/);
    const domSource = ts.sys.readFile(defs[0].fileName);
    const line = domSource.split("\n")[defs[0].start.line];
    assert.match(line.slice(defs[0].start.character), /^HTMLDivElement/);
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

  it("classifies JavaScript and consecutive shorthand properties", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-semantic.jsox";
    const source = `export function Rxjs() {
  const clockEl = <time> {
    .className = "clock"
    .dateTime = ""
  }
  return clockEl;
}
`;
    session.upsert(file, source);
    const tokens = session.semanticTokens(file);
    const classified = tokens.map((token) => ({
      text: source.slice(token.start, token.end),
      type: token.type,
    }));
    assert.ok(classified.some((token) => token.text === "Rxjs" && token.type === 10));
    assert.ok(classified.some((token) => token.text === "clockEl" && token.type === 7));
    assert.ok(classified.some((token) => token.text === "className" && token.type === 9));
    assert.ok(classified.some((token) => token.text === "dateTime" && token.type === 9));
    assert.equal(
      classified.some((token) => /\s|[{}]/.test(token.text)),
      false,
    );
  });

  it("classifies a scoped-tag namespace separately", () => {
    const session = createJsoxSession();
    const file = "/tmp/features-namespace.jsox";
    const source = `const icon = <svg:circle> { .className = "dot" }`;
    session.upsert(file, source);
    const tokens = session.semanticTokens(file);
    assert.ok(
      tokens.some(
        (token) => source.slice(token.start, token.end) === "svg" && token.type === 3,
      ),
    );
  });

  it("accepts and completes web components registered with defineComponent", () => {
    const session = createJsoxSession();
    const file = fileURLToPath(new URL("web-component.jsox", import.meta.url));
    const source = `import { defineComponent } from "../../web-components/src/index.js";
[defineComponent("message-card")] {
  .connected = function () { this.dataset.ready = "yes" }
  .register()
}
const card = <message-card> {
  .id = "example"
}
`;
    session.upsert(file, source);

    assert.deepEqual(session.diagnostics(file), []);
    const hover = session.hover(file, source.indexOf("card ="));
    assert.match(hover.text, /HTMLElement/);

    const incomplete = `${source}\nconst another = <message-`;
    session.upsert(file, incomplete);
    const completions = session.completions(file, incomplete.length, incomplete);
    const component = completions.find((item) => item.label === "message-card");
    assert.equal(component?.detail, "Registered web component");
  });
});
