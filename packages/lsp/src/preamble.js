import { EL, SCOPE } from "@js-ox/compiler/splice";

/** Stubs so TypeScript can type <tag> blocks and [el] scopes as DOM. */
export const PREAMBLE = `/**
 * @template {string | null} N
 * @template {string} K
 * @param {N} namespace
 * @param {K} tag
 * @param {function(this: N extends "svg" ? K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : SVGElement : N extends "html" | null ? K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement : Element): void} [init]
 * @returns {N extends "svg" ? K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : SVGElement : N extends "html" | null ? K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement : Element}
 */
function ${EL}(namespace, tag, init) {
  return /** @type {N extends "svg" ? K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : SVGElement : N extends "html" | null ? K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement : Element} */ (/** @type {unknown} */ (undefined));
}

/**
 * @template T
 * @param {T} el
 * @param {function(this: T): void} [init]
 * @returns {T}
 */
function ${SCOPE}(el, init) {
  return el;
}

`;
