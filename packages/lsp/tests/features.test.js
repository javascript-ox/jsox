import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
});
