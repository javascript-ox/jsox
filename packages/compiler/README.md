# @js-ox/compiler

Compile-time dialect for **JSOX** (JavaScript Object eXtensions): construct objects in place, then emit ordinary JavaScript.

- `<tag> { ... }` constructs a value and runs the block with `this` bound to it
- `.prop` is `this.prop`
- `[value]` composes a part into the object being built

No runtime package. The output is plain JS.

## Install

```bash
npm install -D @js-ox/compiler
```

Node 20+.

## Vite

```js
import { defineConfig } from "vite";
import jsox from "@js-ox/compiler/vite";

export default defineConfig({
  plugins: [jsox()],
});
```

Import `.jsox` files the same way you import `.js`.

## CLI

```bash
npx jsox compile src/main.jsox -o dist/main.js
```

Writes to stdout if `-o` is omitted.

## API

```js
import { compile } from "@js-ox/compiler";

const { code } = compile(source);
```

Optional `jsox.config.js` in the project root can override:

- `create(tag)`, which returns the JavaScript expression used to create a tag
- `tagHandlers`, an object mapping `<>` namespaces to handler functions
- `defaultNamespace` (`html` by default), used for tags without a namespace
- `childMethods` (`append`, `push`, `add` by default)
- `childHelperName` (`$child` by default; must be a valid JavaScript identifier); the compiler adds a numeric suffix if that name is already bound in the source

## Scoped tags

Use `<namespace:tag>` to select a construction handler. JSOX includes `html`
and `svg` handlers, so SVG trees can use the correct DOM namespace directly:

```js
const icon = <svg:svg> {
  .setAttribute("viewBox", "0 0 24 24")
  <svg:circle> {
    .setAttribute("cx", "12")
    .setAttribute("cy", "12")
    .setAttribute("r", "10")
  }
}
```

Register project-specific handlers in `jsox.config.js`. Each handler receives
the local tag name and context, then returns a JavaScript expression string
that constructs the target:

```js
export default {
  tagHandlers: {
    view(tag, { namespace, explicitNamespace, qualifiedName }) {
      return `createView(${JSON.stringify(tag)})`;
    },
  },
  defaultNamespace: "view",
};
```

With that configuration, `<card>` and `<view:card>` both use the `view`
handler. `<html:button>` and `<svg:circle>` can still select the built-in
handlers explicitly.

The existing `create(tag)` option remains supported and configures the built-in
`html` handler for backward compatibility.
