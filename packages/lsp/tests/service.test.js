import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJsService } from "../src/js-service.js";
import { tagCompletions, tagPrefix } from "../src/tags.js";

describe("js-service", () => {
  it("types a tag capture as the matching HTML element", () => {
    const js = createJsService();
    const file = "/tmp/view.jsox";
    const source = `export function view() {
  const el = <button> {
    .type = "button"
  }
  return el;
}
`;
    js.upsert(file, source);
    const diags = js.diagnostics(file);
    const messages = diags.map((d) => String(d.messageText));
    assert.equal(messages.some((m) => /type/.test(m) && /not exist/.test(m)), false);
    const info = js.quickInfo(
      file,
      js.origOffsetToGen(js.get(file), source.indexOf("el")),
    );
    const text = info ? info.displayParts.map((p) => p.text).join("") : "";
    assert.match(text, /HTMLButtonElement/);
  });

  it("types built-in svg namespace captures as SVG elements", () => {
    const js = createJsService();
    const file = "/tmp/icon.jsox";
    const source = `export function icon() {
  const shape = <svg:circle> {
    .setAttribute("r", "10")
  }
  return shape;
}
`;
    js.upsert(file, source);
    assert.deepEqual(js.diagnostics(file), []);
    const info = js.quickInfo(
      file,
      js.origOffsetToGen(js.get(file), source.indexOf("shape")),
    );
    const text = info ? info.displayParts.map((part) => part.text).join("") : "";
    assert.match(text, /SVGCircleElement/);
  });

  it("keeps unqualified tags typed as HTML when custom namespaces are added", () => {
    const js = createJsService({
      namespaceHandlers: {
        react: (tag) => `new ${tag}()`,
      },
    });
    const file = "/tmp/custom-with-html.jsox";
    const source = `const el = <button> { .type = "button" };`;
    js.upsert(file, source);
    assert.deepEqual(js.diagnostics(file), []);
    const info = js.quickInfo(
      file,
      js.origOffsetToGen(js.get(file), source.indexOf("el")),
    );
    const text = info ? info.displayParts.map((part) => part.text).join("") : "";
    assert.match(text, /HTMLButtonElement/);
  });

  it("infers custom default-namespace targets through TypeScript", () => {
    const js = createJsService({
      defaultNamespace: "react",
      namespaceHandlers: {
        react: (tag) => `new ${tag}()`,
      },
    });
    const file = "/tmp/react-element.jsox";
    const source = `class MyReactElement {
  activate() {}
}
const element = <MyReactElement> {
  .activate()
};`;
    js.upsert(file, source);
    assert.deepEqual(js.diagnostics(file), []);
    const info = js.quickInfo(
      file,
      js.origOffsetToGen(js.get(file), source.indexOf("element =")),
    );
    const text = info ? info.displayParts.map((part) => part.text).join("") : "";
    assert.match(text, /MyReactElement/);
  });

  it("completes this-shorthand as element properties", () => {
    const js = createJsService();
    const file = "/tmp/props.jsox";
    const source = `<button> {
  .type = "button"
}`;
    js.upsert(file, source);
    const orig = source.indexOf(".type") + 1;
    const gen = js.origOffsetToGen(js.get(file), orig);
    const info = js.completions(file, gen);
    const names = new Set((info?.entries ?? []).map((e) => e.name));
    assert.ok(names.has("className") || names.has("type") || names.has("addEventListener"));
  });

  it("completes after a lone this-shorthand dot", () => {
    const js = createJsService();
    const file = "/tmp/dot.jsox";
    const source = `<button> {
  .
}`;
    js.upsert(file, source);
    const orig = source.indexOf(".") + 1;
    const gen = js.origOffsetToGen(js.get(file), orig);
    const info = js.completions(file, gen);
    const names = new Set((info?.entries ?? []).map((e) => e.name));
    assert.ok(names.has("className") || names.has("addEventListener"));
  });

  it("completes while a tag block is still unclosed", () => {
    const js = createJsService();
    const file = "/tmp/typing.jsox";
    const source = `export function view() {
  const el = <button> {
    .
`;
    js.upsert(file, source);
    assert.equal(js.get(file).error, undefined);
    const orig = source.lastIndexOf(".") + 1;
    const gen = js.origOffsetToGen(js.get(file), orig);
    const info = js.completions(file, gen);
    const names = new Set((info?.entries ?? []).map((e) => e.name));
    assert.ok(names.has("className") || names.has("addEventListener"));
  });

  it("offers signature help for element methods", () => {
    const js = createJsService();
    const file = "/tmp/sig.jsox";
    const source = `<button> {
  .setAttribute("aria-label", "Go")
}`;
    js.upsert(file, source);
    const orig = source.indexOf("(") + 1;
    const help = js.signatures(file, js.origOffsetToGen(js.get(file), orig));
    assert.ok(help);
    const label = help.items
      .map((item) => item.prefixDisplayParts.map((p) => p.text).join(""))
      .join("\n");
    assert.match(label, /setAttribute/);
  });
});

describe("tag completions", () => {
  it("detects a tag prefix after <", () => {
    assert.equal(tagPrefix("<bu", 3), "bu");
    assert.equal(tagPrefix("<", 1), "");
    assert.equal(tagPrefix("<svg:ci", 7), "ci");
    assert.equal(tagPrefix("const x = 1", 11), null);
  });

  it("suggests HTML tags", () => {
    const items = tagCompletions("<bu", 3);
    const labels = items.map((i) => i.label);
    assert.ok(labels.includes("button"));
    assert.equal(labels.some((l) => l.startsWith("bu")), true);
  });

  it("suggests tag namespaces and SVG tags", () => {
    const namespaces = tagCompletions("<sv", 3);
    assert.equal(namespaces.some((item) => item.label === "svg:"), true);

    const svg = tagCompletions("<svg:cir", 8);
    assert.deepEqual(svg.map((item) => item.label), ["circle"]);
    assert.equal(svg[0].detail, "SVG element");
  });

  it("suggests configured namespace names", () => {
    const items = tagCompletions("<re", 3, {
      namespaces: ["html", "svg", "react"],
    });
    assert.deepEqual(items.map((item) => item.label), ["react:"]);
  });
});
