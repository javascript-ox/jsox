import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compile, EL, SCOPE } from "../src/compile.js";

function js(source, config) {
  return compile(source, config).code;
}

describe("compile: nested tags + captures", () => {
  it("compiles the motivating example", () => {
    const code = js(`const box = <div> {
  .className = "box"
  <p> {
    ["Hello world"]
    <strong> {
      ["Hello World!!!"]
    }
  }
}`);
    assert.equal(code.includes(EL), false);
    assert.equal(code.includes(SCOPE), false);
    assert.match(code, /document\.createElement\("div"\)/);
    assert.match(code, /document\.createElement\("p"\)/);
    assert.match(code, /document\.createElement\("strong"\)/);
    assert.match(code, /\$child/);
    assert.match(code, /Hello world/);
    assert.match(code, /Hello World!!!/);
  });

  it("does not insert a bare string", () => {
    const code = js(`<p> { "hello" }`);
    assert.equal(code.includes("$child(this, \"hello\")"), false);
    assert.match(code, /"hello"/);
  });

  it("does not insert a call", () => {
    const code = js(`<div> { makeNode() }`);
    assert.equal(code.includes("$child(this, makeNode())"), false);
    assert.match(code, /makeNode\(\)/);
  });

  it("does not parse a capture as member access after a property write", () => {
    const code = js(`<span> {
  .className = "count"
  [String(n)]
}`);
    assert.match(code, /this\.className = "count"/);
    assert.match(code, /\$child\(this, String\(n\)\)/);
    assert.equal(code.includes('"count"[String(n)]'), false);
  });

  it("keeps button label and onclick as separate statements", () => {
    const code = js(`<button> {
  .setAttribute("aria-label", "Increase")
  ["+"]
  .onclick = handler
}`);
    assert.match(code, /setAttribute\("aria-label", "Increase"\)/);
    assert.match(code, /\$child\(this, "\+"\)/);
    assert.match(code, /this\.onclick = handler/);
    assert.equal(code.includes(')["+"]'), false);
  });

  it("inserts [makeNode()]", () => {
    const code = js(`<div> { [makeNode()] }`);
    assert.match(code, /\$child\(this, makeNode\(\)\)/);
  });

  it("inserts multiple capture elements", () => {
    const code = js(`<div> { [a, b] }`);
    assert.match(code, /\$child\(this, a, b\)/);
  });

  it("omits $child when there are no nested captures", () => {
    const { code, usedChild } = compile(`[myObject] { .doThing() }`);
    assert.equal(usedChild, false);
    assert.equal(code.includes("function $child"), false);
    assert.match(code, /this\.doThing\(\)/);
    assert.match(code, /\.call\(myObject\)/);
  });
});

describe("compile: assignments", () => {
  it("rewrites unbound assignment in a construct", () => {
    const code = js(`<div> { className = "card" }`);
    assert.match(code, /this\.className = "card"/);
  });

  it("does not rewrite a declared binding", () => {
    const code = js(`let selected;\n<div> { selected = this; className = "x" }`);
    assert.match(code, /selected = this/);
    assert.match(code, /this\.className = "x"/);
  });
});

describe("compile: control flow", () => {
  it("inserts nested captures inside if", () => {
    const code = js(`<div> { if (ok) { <p> { ["x"] } } }`);
    assert.match(code, /if \(ok\)/);
    assert.match(code, /createElement\("p"\)/);
    assert.match(code, /\$child\(this, "x"\)/);
  });

  it("inserts nested captures inside for-of", () => {
    const code = js(`<ul> { for (const item of items) { <li> { [item] } } }`);
    assert.match(code, /for \(const item of items\)/);
    assert.match(code, /createElement\("li"\)/);
    assert.match(code, /\$child\(this, item\)/);
  });
});

describe("compile: config", () => {
  it("uses a custom create() snippet", () => {
    const code = js(`<div>`, {
      create(tag) {
        return `h(${JSON.stringify(tag)})`;
      },
    });
    assert.match(code, /h\("div"\)/);
    assert.equal(code.includes("createElement"), false);
  });

  it("emits this.append in strict single-method mode", () => {
    const code = js(`<div> { ["hi"] }`, {
      childMethods: ["append"],
      strict: true,
    });
    assert.equal(code.includes("function $child"), false);
    assert.match(code, /this\.append\("hi"\)/);
  });

  it("emits a no-op $child when childMethods is empty", () => {
    const code = js(`<div> { ["hi"] }`, { childMethods: [] });
    assert.match(code, /function \$child\(p, \.\.\.n\) \{\}/);
  });
});

describe("compile: arrays vs captures", () => {
  it("keeps [x] as an array in ordinary JS", () => {
    const code = js(`const a = [x];`);
    assert.match(code, /const a = \[x\]/);
    assert.equal(code.includes("$child"), false);
  });

  it("keeps foo([x]) as an array argument", () => {
    const code = js(`<div> { foo([x]) }`);
    assert.match(code, /foo\(\[x\]\)/);
  });
});

describe("compile: POJO trees", () => {
  it("builds a nested object via add()", () => {
    const { code } = compile(`
function track(title) { return { title }; }
const album = {
  title: "",
  year: 0,
  tracks: [],
  add(...items) { this.tracks.push(...items); }
};
[album] {
  .title = "Night Bus"
  .year = 2026
  [track("Wire")]
  [track("Salt")]
}
globalThis.__album = album;
`);
    const g = {};
    new Function("globalThis", code)(g);
    assert.equal(g.__album.constructor.name, "Object");
    assert.equal(g.__album.title, "Night Bus");
    assert.equal(g.__album.year, 2026);
    assert.deepEqual(g.__album.tracks, [{ title: "Wire" }, { title: "Salt" }]);
  });
});

