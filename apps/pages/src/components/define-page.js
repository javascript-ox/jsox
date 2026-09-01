import { defineComponent } from "@js-ox/web-components";

export function definePage(tagName, view) {
  const definition = defineComponent(tagName);
  definition.connected = function () {
    if (!this.hasChildNodes()) this.append(view());
  };
  definition.register();
}
