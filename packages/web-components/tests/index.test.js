import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { compile } from "@js-ox/compiler";
import { defineComponent } from "../src/index.js";

function environment() {
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  return {
    window,
    options: {
      base: window.HTMLElement,
      registry: window.customElements,
    },
  };
}

describe("defineComponent", () => {
  it("registers a native custom element and clones its template per instance", () => {
    const { window, options } = environment();
    const definition = defineComponent("user-card", options);
    definition.template = window.document.createElement("article");
    definition.template.textContent = "User";
    const Component = definition.register();

    const first = window.document.createElement("user-card");
    const second = window.document.createElement("user-card");
    window.document.body.append(first, second);
    assert.ok(first instanceof Component);
    assert.equal(first.innerHTML, "<article>User</article>");
    assert.notEqual(first.firstChild, second.firstChild);
  });

  it("maps definition hooks to native custom-element callbacks", () => {
    const { window, options } = environment();
    const calls = [];
    const definition = defineComponent("status-light", options);
    definition.observedAttributes = ["status"];
    definition.connected = function () {
      calls.push(["connected", this.localName]);
    };
    definition.disconnected = function () {
      calls.push(["disconnected", this.localName]);
    };
    definition.attributeChanged = function (name, oldValue, newValue) {
      calls.push([name, oldValue, newValue]);
    };
    definition.register();

    const element = window.document.createElement("status-light");
    element.setAttribute("status", "ready");
    window.document.body.append(element);
    element.remove();

    assert.deepEqual(calls, [
      ["status", null, "ready"],
      ["connected", "status-light"],
      ["disconnected", "status-light"],
    ]);
  });

  it("preserves lifecycle callbacks implemented by a custom base class", () => {
    const { window, options } = environment();
    const calls = [];
    class ComponentBase extends window.HTMLElement {
      connectedCallback() {
        calls.push("base connected");
      }

      disconnectedCallback() {
        calls.push("base disconnected");
      }

      adoptedCallback() {
        calls.push("base adopted");
      }

      attributeChangedCallback(name, oldValue, newValue) {
        calls.push(["base attribute", name, oldValue, newValue]);
      }
    }

    const definition = defineComponent("based-card", {
      ...options,
      base: ComponentBase,
    });
    definition.observedAttributes = ["status"];
    definition.connected = () => calls.push("definition connected");
    definition.disconnected = () => calls.push("definition disconnected");
    definition.adopted = () => calls.push("definition adopted");
    definition.attributeChanged = (name, oldValue, newValue) => {
      calls.push(["definition attribute", name, oldValue, newValue]);
    };
    definition.register();

    const element = window.document.createElement("based-card");
    element.setAttribute("status", "ready");
    window.document.body.append(element);
    element.remove();
    element.adoptedCallback();

    assert.deepEqual(calls, [
      ["base attribute", "status", null, "ready"],
      ["definition attribute", "status", null, "ready"],
      "base connected",
      "definition connected",
      "base disconnected",
      "definition disconnected",
      "base adopted",
      "definition adopted",
    ]);
  });

  it("clones the content of a native template element", () => {
    const { window, options } = environment();
    const definition = defineComponent("template-card", options);
    const template = window.document.createElement("template");
    template.innerHTML = "<span>From template</span>";
    definition.template = template;
    definition.register();

    const element = window.document.createElement("template-card");
    window.document.body.append(element);
    assert.equal(element.innerHTML, "<span>From template</span>");
  });

  it("works as a definition target in existing JSOX syntax", () => {
    const { window, options } = environment();
    const source = `
      [defineComponent("message-card", options)] {
        .template = <article> {
          .className = "message"
          ["Hello"]
        }
        .connected = function () {
          this.dataset.connected = "yes"
        }
        .register()
      }
    `;
    const { code } = compile(source);
    const load = new Function("defineComponent", "options", "document", code);
    load(defineComponent, options, window.document);

    const element = window.document.createElement("message-card");
    window.document.body.append(element);
    assert.equal(element.innerHTML, '<article class="message">Hello</article>');
    assert.equal(element.dataset.connected, "yes");
  });
});
