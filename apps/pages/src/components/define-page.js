import { defineComponent } from "@js-ox/web-components";

export function definePage(tagName, view) {
  const definition = defineComponent(tagName);
  definition.connected = function () {
    if (this.hasChildNodes()) return;
    const node = view();
    if (node != null) this.append(node);
  };
  definition.register();
}
