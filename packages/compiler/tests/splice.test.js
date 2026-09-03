import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { splice, spliceWithMap, origToGen, origCursorToGen, genToOrig, EL, SCOPE } from "../src/splice.js";

describe("splice: <tag>", () => {
  it("rewrites a bare tag", () => {
    assert.equal(splice("<div>").trim(), `${EL}(null, "div", null, null)`);
  });

  it("rewrites a tag with a block", () => {
    const out = splice("<div> { }");
    assert.match(out, new RegExp(`${EL}\\(null, "div", null, null, function\\(\\)\\{`));
  });

  it("allows hyphenated custom elements", () => {
    assert.equal(splice("<my-widget>").trim(), `${EL}(null, "my-widget", null, null)`);
  });

  it("rewrites namespaced tags", () => {
    assert.equal(
      splice("<svg:linear-gradient>").trim(),
      `${EL}("svg", "linear-gradient", null, null)`,
    );
  });

  it("requires both namespace segments to touch the colon", () => {
    assert.equal(splice("<svg: circle>"), "<svg: circle>");
    assert.equal(splice("<svg :circle>"), "<svg :circle>");
  });

  it("leaves comparisons alone", () => {
    assert.equal(splice("a < b").trim(), "a < b");
    assert.equal(splice("a < b && c > d").trim(), "a < b && c > d");
  });

  it("leaves multiline comparisons alone", () => {
    const source = `const x = a
< b > c;`;
    assert.equal(splice(source), source);
  });

  it("requires tag names to touch both delimiters", () => {
    assert.equal(splice("< div>"), "< div>");
    assert.equal(splice("<div >"), "<div >");
  });

  it("leaves array index alone", () => {
    assert.equal(splice("arr[i]").trim(), "arr[i]");
  });

  it("nests tags", () => {
    const out = splice("<div> { <p> { } }");
    assert.match(out, new RegExp(`${EL}\\(null, "div", null`));
    assert.match(out, new RegExp(`${EL}\\(null, "p", null`));
  });

  it("accepts an LSP-only type witness", () => {
    const out = spliceWithMap(`<react:MyButton>`, {
      typeWitness(namespace, tag) {
        assert.equal(namespace, "react");
        assert.equal(tag, "MyButton");
        return `React.createElement(MyButton)`;
      },
    }).code;
    assert.match(out, /React\.createElement\(MyButton\)/);
  });

  it("accepts separate target and result type witnesses", () => {
    const out = spliceWithMap(`<react:MyButton>`, {
      typeWitness() {
        return {
          target: `new ElementBuilder(MyButton)`,
          result: `React.createElement(MyButton)`,
        };
      },
    }).code;
    assert.match(
      out,
      /new ElementBuilder\(MyButton\), React\.createElement\(MyButton\)/,
    );
  });
});

describe("splice: leading-dot", () => {
  it("rewrites .ident at a primary start", () => {
    const out = splice("<p> { .innerText = \"hello\" }");
    assert.match(out, /this\.innerText = "hello"/);
  });

  it("does not rewrite member access", () => {
    assert.equal(splice("foo.bar").trim(), "foo.bar");
  });

  it("leaves floats alone", () => {
    assert.equal(splice("const x = .5").trim(), "const x = .5");
    assert.equal(splice("const x = .0e1").trim(), "const x = .0e1");
  });

  it("rewrites chained methods after this-shorthand", () => {
    const out = splice("<p> { .classList.add(\"on\") }");
    assert.match(out, /this\.classList\.add\("on"\)/);
  });

  it("rewrites consecutive this-shorthands on new lines", () => {
    const out = splice(`<p> {
  .innerText = "hello"
  .classList.add("on")
}`);
    assert.match(out, /this\.innerText = "hello"/);
    assert.match(out, /this\.classList\.add\("on"\)/);
    assert.equal(out.includes('this.innerText = "hello".classList'), false);
  });
});

describe("splice: [expr] { }", () => {
  it("rewrites a target-scope block", () => {
    const out = splice("[myDiv] { .id = \"x\" }");
    assert.match(out, new RegExp(`${SCOPE}\\(\\(myDiv\\), function\\(\\)\\{`));
    assert.match(out, /this\.id = "x"/);
  });

  it("rewrites [document.body] { }", () => {
    const out = splice("[document.body] { [box] }");
    assert.match(out, new RegExp(`${SCOPE}\\(\\(document\\.body\\)`));
    assert.match(out, /\[box\]/);
  });

  it("does not steal foo[bar] { }", () => {
    const out = splice("foo[bar] { z }");
    assert.equal(out.includes(SCOPE), false);
    assert.match(out, /foo\[bar\]/);
  });

  it("leaves a top-level array literal alone", () => {
    assert.equal(splice("const a = [x]").trim(), "const a = [x]");
  });
});

describe("spliceWithMap", () => {
  it("maps this-shorthand back to the original dot", () => {
    const src = "<p> { .innerText = \"hi\" }";
    const { code, maps } = spliceWithMap(src);
    const genDot = origToGen(maps, src.indexOf(".innerText"));
    assert.equal(code[genDot], ".");
    assert.equal(code.slice(genDot - 4, genDot + 10), "this.innerText");
    assert.equal(src[genToOrig(maps, genDot)], ".");
  });

  it("keeps splice() and spliceWithMap().code equal", () => {
    const src = "<div> { .className = \"x\"; [child] }";
    assert.equal(spliceWithMap(src).code, splice(src));
  });

  it("does not rewrite a lone dot unless incompleteThis is set", () => {
    const src = "<button> {\n  .\n}";
    assert.equal(spliceWithMap(src).code.includes("this."), false);
    assert.equal(spliceWithMap(src, { incompleteThis: true }).code.includes("this."), true);
  });

  it("maps a cursor at the end of an incomplete shorthand", () => {
    const source = `<h> {\n  .`;
    const result = spliceWithMap(source, { incompleteThis: true, recover: true });
    const generated = origToGen(result.maps, source.length);
    assert.equal(result.code.slice(generated - 5, generated), "this.");
  });

  it("prefers a shorthand endpoint inside a completed selector", () => {
    const source = `<div> {\n  .\n  .style = {}\n}`;
    const result = spliceWithMap(source, { incompleteThis: true, recover: true });
    const generated = origCursorToGen(result.maps, source.indexOf(".\n") + 1);
    assert.equal(result.code.slice(generated - 5, generated), "this.");
  });
});
