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

/**
 * If `offset` is inside a JSOX tag name (`<`, `<bu`, …), return the typed prefix.
 * Otherwise null.
 */
export function tagPrefix(source, offset) {
  const before = source.slice(0, offset);
  const m = before.match(/<([A-Za-z][\w-]*)?$/);
  if (!m) return null;
  return m[1] ?? "";
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
  const lower = prefix.toLowerCase();
  const registered = new Set(registeredComponentTags(source));
  return [...registered, ...HTML_TAGS]
    .filter((tag, index, tags) => tag.startsWith(lower) && tags.indexOf(tag) === index)
    .map((tag) => ({
      label: tag,
      kind: 7, // CompletionItemKind.Class
      detail: registered.has(tag) ? "Registered web component" : "HTML element",
      insertText: tag,
    }));
}
