/** Default child-insert methods: DOM, arrays, then Set-like. */
export const defaultConfig = {
  create(tag) {
    return `document.createElement(${JSON.stringify(tag)})`;
  },
  childMethods: ["append", "push", "add"],
  childHelperName: "$child",
  strict: false,
};

export function normalizeConfig(input = {}) {
  const create =
    typeof input.create === "function" ? input.create : defaultConfig.create;
  const childMethods = Array.isArray(input.childMethods)
    ? input.childMethods.map(String)
    : [...defaultConfig.childMethods];
  const childHelperName =
    typeof input.childHelperName === "string"
      ? input.childHelperName
      : defaultConfig.childHelperName;
  const strict = Boolean(input.strict);
  return { create, childMethods, childHelperName, strict };
}

export async function loadConfig(dir = process.cwd()) {
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const url = pathToFileURL(join(dir, "jsox.config.js")).href;
  try {
    const mod = await import(url);
    return normalizeConfig(mod.default ?? mod);
  } catch (err) {
    if (err && (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "ENOENT")) {
      return normalizeConfig();
    }
    throw err;
  }
}

export function childHelperSource(config, helperName = config.childHelperName) {
  const methods = config.childMethods;
  if (config.strict && methods.length === 1) return "";
  if (methods.length === 0) {
    return `function ${helperName}(p, ...n) {}\n`;
  }
  const chain = methods.map((m) => `p.${m}`).join(" || ");
  return `function ${helperName}(p, ...n) {\n  const m = ${chain};\n  if (m) m.apply(p, n);\n}\n`;
}
