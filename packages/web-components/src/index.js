/**
 * A mutable definition target designed to be configured by a JSOX scope block.
 */
export class ComponentDefinition {
  /** @type {Node | HTMLTemplateElement | null} */
  template = null;

  /** @type {string[]} */
  observedAttributes = [];

  /** @type {boolean} */
  formAssociated = false;

  /** @type {((this: HTMLElement) => void) | null} */
  connected = null;

  /** @type {((this: HTMLElement) => void) | null} */
  disconnected = null;

  /** @type {((this: HTMLElement) => void) | null} */
  adopted = null;

  /** @type {((this: HTMLElement, name: string, oldValue: string | null, newValue: string | null) => void) | null} */
  attributeChanged = null;

  #name;
  #base;
  #registry;
  #defineOptions;

  constructor(name, options = {}) {
    this.#name = name;
    this.#base = options.base ?? globalThis.HTMLElement;
    this.#registry = options.registry ?? globalThis.customElements;
    this.#defineOptions = options.extends ? { extends: options.extends } : undefined;
  }

  /**
   * Create and register the configured custom-element class.
   * @returns {CustomElementConstructor}
   */
  register() {
    if (!this.#base) throw new Error("HTMLElement is not available in this environment");
    if (!this.#registry) throw new Error("customElements is not available in this environment");

    const template = this.template;
    const observedAttributes = [...this.observedAttributes];
    const formAssociated = Boolean(this.formAssociated);
    const connected = this.connected;
    const disconnected = this.disconnected;
    const adopted = this.adopted;
    const attributeChanged = this.attributeChanged;
    const Base = this.#base;

    class JsoxComponent extends Base {
      static observedAttributes = observedAttributes;
      static formAssociated = formAssociated;
      #templateInitialized = false;

      connectedCallback() {
        if (!this.#templateInitialized) {
          this.#templateInitialized = true;
          const content = cloneTemplate(template);
          if (content) this.append(content);
        }
        connected?.call(this);
      }

      disconnectedCallback() {
        disconnected?.call(this);
      }

      adoptedCallback() {
        adopted?.call(this);
      }

      attributeChangedCallback(name, oldValue, newValue) {
        attributeChanged?.call(this, name, oldValue, newValue);
      }
    }

    this.#registry.define(this.#name, JsoxComponent, this.#defineOptions);
    return JsoxComponent;
  }
}

/**
 * Create a component definition for use as a JSOX target scope.
 *
 * @param {string} name
 * @param {{ base?: CustomElementConstructor, registry?: CustomElementRegistry, extends?: string }} [options]
 */
export function defineComponent(name, options) {
  return new ComponentDefinition(name, options);
}

function cloneTemplate(template) {
  if (!template) return null;
  if ("content" in template && template.content?.cloneNode) {
    return template.content.cloneNode(true);
  }
  if (typeof template.cloneNode !== "function") {
    throw new TypeError("component template must be a DOM node");
  }
  return template.cloneNode(true);
}
