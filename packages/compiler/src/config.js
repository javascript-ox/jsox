function createHtmlElement(tag) {
  return `document.createElement(${JSON.stringify(tag)})`;
}

function createSvgElement(tag) {
  return `document.createElementNS("http://www.w3.org/2000/svg", ${JSON.stringify(tag)})`;
}

const NAMESPACE_NAME = /^[A-Za-z][\w-]*$/;

/** Default child-insert methods: DOM, arrays, then Set-like. */
export const defaultConfig = {
  create: createHtmlElement,
  tagHandlers: {
    html: createHtmlElement,
    svg: createSvgElement,
  },
  defaultNamespace: "html",
  childMethods: ["append", "push", "add"],
  childHelperName: "$child",
  strict: false,
};

export function normalizeConfig(input = {}) {
  const legacyCreate =
    typeof input.create === "function" ? input.create : defaultConfig.create;
  const suppliedHandlers = input.tagHandlers ?? {};
  if (
    suppliedHandlers === null ||
    typeof suppliedHandlers !== "object" ||
    Array.isArray(suppliedHandlers)
  ) {
    throw new TypeError("config.tagHandlers must be an object of functions");
  }
  const tagHandlers = {
    ...defaultConfig.tagHandlers,
    html: legacyCreate,
  };
  for (const [namespace, handler] of Object.entries(suppliedHandlers)) {
    if (!NAMESPACE_NAME.test(namespace)) {
      throw new TypeError(`Invalid tag namespace ${JSON.stringify(namespace)}`);
    }
    if (typeof handler !== "function") {
      throw new TypeError(`config.tagHandlers.${namespace} must be a function`);
    }
    tagHandlers[namespace] = handler;
  }
  const defaultNamespace =
    input.defaultNamespace === undefined
      ? defaultConfig.defaultNamespace
      : String(input.defaultNamespace);
  if (!NAMESPACE_NAME.test(defaultNamespace)) {
    throw new TypeError("config.defaultNamespace must be a valid namespace name");
  }
  if (!Object.hasOwn(tagHandlers, defaultNamespace)) {
    throw new TypeError(
      `config.defaultNamespace references unknown tag namespace ${JSON.stringify(defaultNamespace)}`,
    );
  }
  const childMethods = Array.isArray(input.childMethods)
    ? input.childMethods.map(String)
    : [...defaultConfig.childMethods];
  const childHelperName =
    typeof input.childHelperName === "string"
      ? input.childHelperName
      : defaultConfig.childHelperName;
  const strict = Boolean(input.strict);
  return {
    create: tagHandlers.html,
    tagHandlers,
    defaultNamespace,
    childMethods,
    childHelperName,
    strict,
  };
}

export async function loadConfig(dir = process.cwd()) {
  const { access } = await import("node:fs/promises");
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const path = join(dir, "jsox.config.js");
  try {
    await access(path);
  } catch (err) {
    if (err?.code === "ENOENT") return normalizeConfig();
    throw err;
  }
  const mod = await import(pathToFileURL(path).href);
  return normalizeConfig(mod.default ?? mod);
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
