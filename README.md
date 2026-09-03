# JSOX

**JavaScript Object eXtensions** is a compile-time JavaScript dialect for
constructing objects with nested, object-scoped blocks.

```js
export function Profile(name) {
  return <article> {
    .className = "profile"
    <h2> { [name] }
    <button> {
      .type = "button"
      .onclick = () => console.log(`Hello, ${name}`)
      ["Say hello"]
    }
  }
}

[document.body] {
  [Profile("Ada")]
}
```

JSOX compiles to ordinary JavaScript. It has no required browser runtime and
is not a rendering framework: objects are created immediately, properties are
assigned directly, and values are composed using methods the target already
provides.

[Explore the examples](https://javascript-ox.github.io/jsox/) ·
[View the development site](https://javascript-ox.github.io/jsox/develop/) ·
[Report an issue](https://github.com/javascript-ox/jsox/issues)

## The language

JSOX adds three related forms to JavaScript:

```js
const list = <ul> {       // create a target and enter its scope
  .className = "items"   // shorthand for this.className
  <li> { ["One"] }       // create and compose a nested target
  <li> { ["Two"] }
}

[document.body] { [list] } // enter an existing target and compose a value
```

- `<tag> { ... }` creates a value and runs the block with `this` bound to it.
- `.property` and `.method()` operate on that current value.
- `[value]` composes a value into the current target.

For DOM elements, composition uses `append()`. The same syntax also works with
plain objects that expose a supported composition method such as `push()` or
`add()`.

## Quick start

JSOX requires Node.js 20 or newer.

```bash
npm install -D @js-ox/compiler
```

Add the Vite plugin:

```js
// vite.config.js
import { defineConfig } from "vite";
import jsox from "@js-ox/compiler/vite";

export default defineConfig({
  plugins: [jsox()],
});
```

Then import `.jsox` files like ordinary JavaScript modules. You can also compile
from the command line:

```bash
npx jsox compile src/main.jsox -o dist/main.js
```

See the [compiler documentation](packages/compiler/README.md) for the JavaScript
API and configuration options.

## Packages

| Package | Purpose |
| --- | --- |
| [`@js-ox/compiler`](packages/compiler) | Compiler, CLI, and Vite integration |
| [`@js-ox/lsp`](packages/lsp) | Completions, hover, definitions, diagnostics, and semantic tokens |
| [`@js-ox/web-components`](packages/web-components) | Small helpers for defining native custom elements with JSOX |

## Editor support

- **VS Code:** install the extension from [`plugins/vscode`](plugins/vscode).
- **IntelliJ IDEA Ultimate / WebStorm:** build or install the plugin from
  [`plugins/intellij`](plugins/intellij). It uses JetBrains' built-in LSP API.
- **Other LSP clients:** launch `jsox-lsp` over stdio, or run
  `node packages/lsp/src/cli.js` from this repository.

The language server delegates JavaScript intelligence to TypeScript while
mapping positions through JSOX syntax.

## Examples

The [example gallery](https://javascript-ox.github.io/jsox/) includes basic DOM
and plain-object examples as well as integrations with:

- React, Vue, Svelte, Solid, Alpine, HTMX, Stimulus, and native Web Components
- Material UI, PrimeVue, Lit, and shadcn/ui-style primitives
- RxJS, Effect, XState, MobX, and Zod
- Three.js, D3, Chart.js, GSAP, and SortableJS
- TanStack Query and TanStack Table

Every example displays the JSOX source responsible for its core behavior.

Run the complete gallery locally:

```bash
npm install
npm run pages
```

Or run an individual example, such as:

```bash
npm run example:counter
npm run example:three
```

## Scoped tags

Selectors can choose a configured construction namespace. Built-in `html` and
`svg` namespaces keep DOM typing, while custom handlers can create any kind of
target:

```js
const icon = <svg:circle> {
  .setAttribute("r", "10")
}
```

A handler may be a creation function or an object with separate construction
and finalization phases. This lets a mutable JSOX scope produce an immutable
result such as a React element or Vue VNode:

```js
export default {
  namespaceHandlers: {
    react: {
      tags: ["article", "button", "CounterCard"],
      types: {
        target: "ReactNodeBuilder",
        result: "React.ReactElement",
      },
      create: tag => `new ReactNodeBuilder(${tag})`,
      finalize: target => `finalizeReactNode(${target})`,
    },
  },
};
```

`tags` supplies completion items after `<react:`. The optional TypeScript
metadata explicitly types `this` inside the block and the completed selector;
each hint may also be a `(tag, context) => typeString` function. Without these
hints, the LSP continues to infer types from the creation and finalization
expressions. See the standalone
[`React`](examples/react) and [`Vue`](examples/vue) examples.

## Web Components

`@js-ox/web-components` keeps the platform architecture intact: definitions
produce native custom-element classes without adding a render engine or state
system.

```js
import { defineComponent } from "@js-ox/web-components";

[defineComponent("hello-card")] {
  .template = <article> {
    <slot>
  }
  .connected = function () {
    console.log("connected", this)
  }
  .register()
}
```

See the [Web Components documentation](packages/web-components/README.md) for
lifecycle hooks and registration behavior.

## Roadmap

The central goal for **0.2.0** is making selectors extensible beyond their
current construction model:

- [x] Custom handlers/factories for `<>` selectors
- [x] Namespaced `<>` selectors
- [x] A configurable default selector namespace
- [x] Compiler, LSP, documentation, and backward-compatibility coverage

Follow the detailed checklist in
[issue #19](https://github.com/javascript-ox/jsox/issues/19). This work
provides a clean foundation for richer integrations—including React and
Vue—without coupling the compiler to a particular framework.

## Development

This repository is an npm workspace containing the published packages, the
documentation site, editor plugins, and standalone examples.

```bash
npm install
npm test
npm run build:site
```

`develop` is the active development branch. `main` represents the stable
release and is published alongside the development build on GitHub Pages.

## License

[MIT](LICENSE)
