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
- `childMethods` (`append`, `push`, `add` by default)
- `childHelperName` (`$child` by default; must be a valid JavaScript identifier); the compiler adds a numeric suffix if that name is already bound in the source
