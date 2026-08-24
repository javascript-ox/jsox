import { splice, EL, SCOPE } from "./splice.js";
import { lower } from "./lower.js";
import { normalizeConfig } from "./config.js";

export { splice, spliceWithMap, origToGen, genToOrig, EL, SCOPE } from "./splice.js";
export { normalizeConfig, defaultConfig, loadConfig } from "./config.js";

/**
 * Compile dialect source to plain JavaScript.
 * @param {string} source
 * @param {object} [config]
 * @returns {{ code: string, spliced: string, usedChild: boolean }}
 */
export function compile(source, config) {
  const cfg = normalizeConfig(config);
  const spliced = splice(source);
  const { code, usedChild } = lower(spliced, cfg);
  return { code, spliced, usedChild };
}
