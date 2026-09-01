# @js-ox/web-components

Small helpers for defining native web components with JSOX. There is no render
engine, reactive state system, or component-specific compiler transform.

```bash
npm install @js-ox/web-components
```

## Define a component

The definition object is a normal JSOX target. Its block runs once while the
module loads, and `register()` creates and registers a native custom-element
class.

```js
import { defineComponent } from "@js-ox/web-components";

[defineComponent("user-card")] {
  .template = <article> {
    <slot>
  }
  .observedAttributes = ["name"]
  .connected = function () {
    console.log("connected", this)
  }
  .attributeChanged = function (name, oldValue, newValue) {
    console.log(name, oldValue, newValue)
  }
  .register()
}
```

On its first connection, each element receives a deep clone of `template` in
its light DOM before the user-defined `connected` hook runs. Assigning an
`HTMLTemplateElement` clones its `content` instead. Reconnecting the same element
does not clone the template again.

The lifecycle properties map directly to the platform callbacks:

- `connected` → `connectedCallback`
- `disconnected` → `disconnectedCallback`
- `adopted` → `adoptedCallback`
- `attributeChanged` → `attributeChangedCallback`

`observedAttributes` and `formAssociated` become the corresponding static class
fields. `register()` returns the generated custom-element constructor.
