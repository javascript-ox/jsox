function createHtmlElement(tag) {
  return `document.createElement(${JSON.stringify(tag)})`;
}

function createSvgElement(tag) {
  return `document.createElementNS("http://www.w3.org/2000/svg", ${JSON.stringify(tag)})`;
}

const NAMESPACE_NAME = /^[A-Za-z][\w-]*$/;
const TAG_NAME = /^[A-Za-z][\w-]*$/;

function validTypeHint(hint) {
  return hint === undefined || typeof hint === "string" || typeof hint === "function";
}

/** Default child-insert methods: DOM, arrays, then Set-like. */
export const defaultConfig = {
  create: createHtmlElement,
  namespaceHandlers: {
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
  const suppliedNamespaces = input.namespaceHandlers ?? {};
  if (
    suppliedNamespaces === null ||
    typeof suppliedNamespaces !== "object" ||
    Array.isArray(suppliedNamespaces)
  ) {
    throw new TypeError("config.namespaceHandlers must be an object of namespace handlers");
  }
  const namespaceHandlers = {
    ...defaultConfig.namespaceHandlers,
    html: legacyCreate,
  };
  for (const [namespace, factory] of Object.entries(suppliedNamespaces)) {
    if (!NAMESPACE_NAME.test(namespace)) {
      throw new TypeError(`Invalid tag namespace ${JSON.stringify(namespace)}`);
    }
    const objectHandler =
      factory !== null &&
      typeof factory === "object" &&
      !Array.isArray(factory);
    if (
      typeof factory !== "function" &&
      (!objectHandler || typeof factory.create !== "function")
    ) {
      throw new TypeError(
        `config.namespaceHandlers.${namespace} must be a function or an object with create() and optional finalize() functions`,
      );
    }
    if (!objectHandler) {
      namespaceHandlers[namespace] = factory;
      continue;
    }
    if (factory.finalize !== undefined && typeof factory.finalize !== "function") {
      throw new TypeError(`config.namespaceHandlers.${namespace}.finalize must be a function`);
    }
    if (
      factory.tags !== undefined &&
      (!Array.isArray(factory.tags) ||
        factory.tags.some((tag) => typeof tag !== "string" || !TAG_NAME.test(tag)))
    ) {
      throw new TypeError(
        `config.namespaceHandlers.${namespace}.tags must be an array of tag names`,
      );
    }
    if (
      factory.types !== undefined &&
      (factory.types === null ||
        typeof factory.types !== "object" ||
        Array.isArray(factory.types) ||
        !validTypeHint(factory.types.target) ||
        !validTypeHint(factory.types.result))
    ) {
      throw new TypeError(
        `config.namespaceHandlers.${namespace}.types must contain string or function target/result hints`,
      );
    }
    namespaceHandlers[namespace] = factory;
  }
  const defaultNamespace =
    input.defaultNamespace === undefined
      ? defaultConfig.defaultNamespace
      : String(input.defaultNamespace);
  if (!NAMESPACE_NAME.test(defaultNamespace)) {
    throw new TypeError("config.defaultNamespace must be a valid namespace name");
  }
  if (!Object.hasOwn(namespaceHandlers, defaultNamespace)) {
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
    create: namespaceHandlers.html,
    namespaceHandlers,
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
