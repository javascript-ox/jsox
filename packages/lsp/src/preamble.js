import { EL, SCOPE } from "@js-ox/compiler/splice";

/** Stubs so TypeScript can type <tag> blocks and [el] scopes as DOM. */
export const PREAMBLE = `/**
 * @template {string} K
 * @param {K} tag
 * @param {function(this: K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement): void} [init]
 * @returns {K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement}
 */
function ${EL}(tag, init) {
  return /** @type {K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement} */ (/** @type {unknown} */ (undefined));
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
