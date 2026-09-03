import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compile } from "../src/compile.js";

function exec(setup, source, ret) {
  const { code } = compile(source);
  return new Function(`${setup}\n${code}\nreturn (${ret});`)();
}

describe("non-dom", () => {
  it("pushes onto arrays", () => {
    const items = exec(`const items = [];`, `[items] { [1]; [2] }`, `items`);
    assert.deepEqual(items, [1, 2]);
  });

  it("uses add() when present", () => {
    const obj = exec(
      `const obj = { values: [], add(v) { this.values.push(v); } };`,
      `[obj] { ["a"] }`,
      `obj`
    );
    assert.deepEqual(obj.values, ["a"]);
  });

  it("runs block methods and ignores children when no child method exists", () => {
    const obj = exec(
      `const obj = { n: 0, doThing() { this.n++; } };`,
      `[obj] { .doThing(); [99] }`,
      `obj`
    );
    assert.equal(obj.n, 1);
    assert.equal(obj[0], undefined);
  });

  it("builds nested trees through a custom tag handler", () => {
    const { code } = compile(
      `globalThis.tree = <tree:branch> {
        .label = "root"
        <tree:leaf> { .label = "child" }
      }`,
      {
        tagHandlers: {
          tree: (tag) => `({ tag: ${JSON.stringify(tag)}, children: [], add(...items) { this.children.push(...items) } })`,
        },
      },
    );
    const scope = {};
    new Function("globalThis", code)(scope);
    assert.equal(scope.tree.tag, "branch");
    assert.equal(scope.tree.label, "root");
    assert.deepEqual(scope.tree.children.map(({ tag, label }) => ({ tag, label })), [
      { tag: "leaf", label: "child" },
    ]);
  });
});
