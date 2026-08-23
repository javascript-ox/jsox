import { compile } from "./compile.js";
import { loadConfig, normalizeConfig } from "./config.js";

/**
 * Vite plugin: compile `.jsox` files to JavaScript.
 * @param {{ config?: object }} [options]
 */
export default function jsoxPlugin(options = {}) {
  let config = options.config ? normalizeConfig(options.config) : null;
  return {
    name: "jsox",
    enforce: "pre",
    config() {
      return {
        resolve: {
          extensions: [
            ".jsox",
            ".mjs",
            ".js",
            ".mts",
            ".ts",
            ".jsx",
            ".tsx",
            ".json",
          ],
        },
      };
    },
    async configResolved(resolved) {
      if (!config) {
        config = await loadConfig(resolved.root);
      }
    },
    transform(code, id) {
      const file = id.split("?")[0];
      if (!file.endsWith(".jsox")) return null;
      const result = compile(code, config ?? normalizeConfig());
      return { code: result.code, map: null };
    },
  };
}
