import { EL, SCOPE } from "@js-ox/compiler/splice";

/** Stubs so TypeScript can type <tag> blocks and [el] scopes as DOM. */
export const PREAMBLE = `/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {function(this: HTMLElementTagNameMap[K]): void} [init]
 * @returns {HTMLElementTagNameMap[K]}
 */
function ${EL}(tag, init) {
  return /** @type {HTMLElementTagNameMap[K]} */ (/** @type {unknown} */ (undefined));
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
