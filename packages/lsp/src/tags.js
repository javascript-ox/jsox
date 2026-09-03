/** HTMLElementTagNameMap keys — offered after `<` as a dialect extra. */
export const HTML_TAGS = [
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "menu",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "search",
  "section",
  "select",
  "slot",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr",
];

export const SVG_TAGS = [
  "a",
  "animate",
  "animateMotion",
  "animateTransform",
  "circle",
  "clipPath",
  "defs",
  "desc",
  "ellipse",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "filter",
  "foreignObject",
  "g",
  "image",
  "line",
  "linearGradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialGradient",
  "rect",
  "script",
  "set",
  "stop",
  "style",
  "svg",
  "switch",
  "symbol",
  "text",
  "textPath",
  "title",
  "tspan",
  "use",
  "view",
];

/**
 * If `offset` is inside a JSOX tag name (`<`, `<bu`, …), return the typed prefix.
 * Otherwise null.
 */
export function tagPrefix(source, offset) {
  const before = source.slice(0, offset);
  const m = before.match(/<(?:[A-Za-z][\w-]*:)?([A-Za-z][\w-]*)?$/);
  if (!m) return null;
  return m[1] ?? "";
}

function tagNamespace(source, offset) {
  const before = source.slice(0, offset);
  const m = before.match(/<([A-Za-z][\w-]*):(?:[A-Za-z][\w-]*)?$/);
  return m?.[1] ?? null;
}

export function registeredComponentTags(source) {
  const tags = new Set();
  const definition = /\bdefineComponent\s*\(\s*(["'])([a-z][\w.-]*-[\w.-]+)\1/g;
  for (const match of source.matchAll(definition)) tags.add(match[2]);
  return [...tags].sort();
}

export function tagCompletions(source, offset) {
  const prefix = tagPrefix(source, offset);
  if (prefix == null) return null;
  const namespace = tagNamespace(source, offset);
  const lower = prefix.toLowerCase();
  const registered = new Set(registeredComponentTags(source));
  const tags = namespace === "svg"
    ? SVG_TAGS
    : namespace === null || namespace === "html"
      ? [...registered, ...HTML_TAGS]
      : [];
  const namespaces = namespace === null
    ? [
        { label: "html:", detail: "HTML tag namespace" },
        { label: "svg:", detail: "SVG tag namespace" },
      ]
    : [];
  return [
    ...namespaces
      .filter(({ label }) => label.startsWith(lower))
      .map(({ label, detail }) => ({
        label,
        kind: 7,
        detail,
        insertText: label,
      })),
    ...tags
      .filter(
        (tag, index, tags) =>
          tag.toLowerCase().startsWith(lower) && tags.indexOf(tag) === index,
      )
      .map((tag) => ({
        label: tag,
        kind: 7, // CompletionItemKind.Class
        detail: registered.has(tag)
          ? "Registered web component"
          : namespace === "svg"
            ? "SVG element"
            : "HTML element",
        insertText: tag,
      })),
  ];
}
