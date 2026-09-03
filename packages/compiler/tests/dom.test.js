import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { compile } from "../src/compile.js";

function evalInDom(source) {
  const { code } = compile(source);
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  const run = new Function("window", "document", code);
  run(window, window.document);
  return window;
}

describe("dom", () => {
  it("builds a nested element tree", () => {
    const window = evalInDom(`
      const box = <div> {
        .className = "box"
        <p> {
          ["Hello world"]
          <strong> {
            ["Hello World!!!"]
          }
        }
      }
      document.body.append(box)
    `);
    const box = window.document.querySelector("div.box");
    assert.ok(box);
    const p = box.querySelector("p");
    assert.equal(p.textContent, "Hello worldHello World!!!");
    assert.equal(p.querySelector("strong").textContent, "Hello World!!!");
  });

  it("mounts onto an existing node", () => {
    const window = evalInDom(`
      const box = <div> { ["hi"] }
      [document.body] {
        [box]
      }
    `);
    assert.equal(window.document.body.textContent, "hi");
  });

  it("builds namespaced SVG trees", () => {
    const window = evalInDom(`
      const icon = <svg:svg> {
        .setAttribute("viewBox", "0 0 24 24")
        <svg:circle> {
          .setAttribute("cx", "12")
          .setAttribute("cy", "12")
          .setAttribute("r", "10")
        }
      }
      document.body.append(icon)
    `);
    const icon = window.document.querySelector("svg");
    const circle = icon.querySelector("circle");
    assert.equal(icon.namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(circle.namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(circle.getAttribute("r"), "10");
  });
});
