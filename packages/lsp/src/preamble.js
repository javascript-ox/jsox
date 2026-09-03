import { EL, SCOPE } from "@js-ox/compiler/splice";

/** Stubs so TypeScript can type <tag> blocks and [el] scopes as DOM. */
export const PREAMBLE = `/**
 * @template {string | null} N
 * @template {string} K
 * @template T
 * @template R
 * @param {N} namespace
 * @param {K} tag
 * @param {T} witness
 * @param {R} resultWitness
 * @param {function(this: T extends null ? N extends "svg" ? K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : SVGElement : N extends "html" | null ? K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement : Element : T): void} [init]
 * @returns {R extends null ? T extends null ? N extends "svg" ? K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : SVGElement : N extends "html" | null ? K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement : Element : T : R}
 */
function ${EL}(namespace, tag, witness, resultWitness, init) {
  return /** @type {R extends null ? T extends null ? N extends "svg" ? K extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[K] : SVGElement : N extends "html" | null ? K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement : Element : T : R} */ (/** @type {unknown} */ (undefined));
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
