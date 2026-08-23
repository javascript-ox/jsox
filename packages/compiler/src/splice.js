import jsTokens from "js-tokens";

export const EL = "__jsox_el";
export const SCOPE = "__jsox_scope";

const WS = new Set([
  "WhiteSpace",
  "LineTerminatorSequence",
  "SingleLineComment",
  "MultiLineComment",
]);

/** Keywords / contextual words that precede a primary expression. */
const PREFIX_WORDS = new Set([
  "return",
  "throw",
  "typeof",
  "void",
  "delete",
  "await",
  "yield",
  "new",
  "case",
  "else",
  "do",
  "default",
  "extends",
  "in",
  "of",
  "instanceof",
  "with",
]);

function isIdent(tok) {
  return tok && tok.type === "IdentifierName";
}

function isWs(tok) {
  return tok && WS.has(tok.type);
}

function canStartPrimary(prev, sawNewline) {
  if (!prev) return true;
  if (sawNewline) {
    // Dialect forms after a newline start a new statement.
    // (JS would otherwise continue `= "box" < p` as a comparison.)
    return true;
  }
  if (prev.type === "Punctuator") {
    const v = prev.value;
    if (v === ")" || v === "]" || v === "++" || v === "--") return false;
    return true;
  }
  if (prev.type === "IdentifierName") return PREFIX_WORDS.has(prev.value);
  return false;
}

function needsLeadingSemi(prev, sawNewline) {
  if (!prev || !sawNewline) return false;
  if (prev.type === "Punctuator") {
    const v = prev.value;
    if (v === "{" || v === "}" || v === ";" || v === "(") return false;
  }
  return true;
}

function emitRewrite(code, prev, sawNewline) {
  return needsLeadingSemi(prev, sawNewline) ? `;${code}` : code;
}

function skipWs(tokens, i) {
  while (i < tokens.length && isWs(tokens[i])) i++;
  return i;
}

function takeBalanced(tokens, start, open, close) {
  if (tokens[start]?.value !== open) return null;
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === "Punctuator" && tok.value === open) depth++;
    else if (tok.type === "Punctuator" && tok.value === close) {
      depth--;
      if (depth === 0) {
        return {
          inner: tokens.slice(start + 1, i),
          end: i + 1,
        };
      }
    }
  }
  throw new SyntaxError(`Unmatched '${open}' in dialect source`);
}

function join(tokens) {
  return tokens.map((t) => t.value).join("");
}

function tryTag(tokens, i) {
  if (tokens[i]?.value !== "<") return null;
  let j = skipWs(tokens, i + 1);
  if (!isIdent(tokens[j])) return null;
  let name = tokens[j].value;
  j++;
  while (tokens[j]?.value === "-" && isIdent(tokens[j + 1])) {
    name += "-" + tokens[j + 1].value;
    j += 2;
  }
  j = skipWs(tokens, j);
  if (tokens[j]?.value !== ">") return null;
  j++;
  const k = skipWs(tokens, j);
  if (tokens[k]?.value === "{") {
    const block = takeBalanced(tokens, k, "{", "}");
    const body = spliceTokens(block.inner, true);
    return {
      code: `${EL}(${JSON.stringify(name)}, function(){${body}})`,
      end: block.end,
    };
  }
  return { code: `${EL}(${JSON.stringify(name)})`, end: j };
}

function tryScope(tokens, i) {
  if (tokens[i]?.value !== "[") return null;
  let brackets;
  try {
    brackets = takeBalanced(tokens, i, "[", "]");
  } catch {
    return null;
  }
  const k = skipWs(tokens, brackets.end);
  if (tokens[k]?.value !== "{") return null;
  const block = takeBalanced(tokens, k, "{", "}");
  const inner = spliceTokens(brackets.inner, false).trim();
  const body = spliceTokens(block.inner, true);
  const expr = inner.length ? inner : "undefined";
  return {
    code: `${SCOPE}((${expr}), function(){${body}})`,
    end: block.end,
  };
}

function tryDotThis(tokens, i) {
  if (tokens[i]?.value !== ".") return null;
  if (!isIdent(tokens[i + 1])) return null;
  return { code: `this.${tokens[i + 1].value}`, end: i + 2 };
}

function spliceTokens(tokens, inBlock) {
  let i = 0;
  let lastSig = null;
  let sawNewline = false;
  let out = "";
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.type === "LineTerminatorSequence") {
      out += tok.value;
      sawNewline = true;
      i++;
      continue;
    }
    if (isWs(tok)) {
      out += tok.value;
      i++;
      continue;
    }
    const primary = canStartPrimary(lastSig, sawNewline);
    const dotPrimary =
      canStartPrimary(lastSig, false) || (inBlock && sawNewline);
    if (primary) {
      const tag = tryTag(tokens, i);
      if (tag) {
        out += emitRewrite(tag.code, lastSig, sawNewline);
        i = tag.end;
        lastSig = { type: "Punctuator", value: ")" };
        sawNewline = false;
        continue;
      }
      const scope = tryScope(tokens, i);
      if (scope) {
        out += emitRewrite(scope.code, lastSig, sawNewline);
        i = scope.end;
        lastSig = { type: "Punctuator", value: ")" };
        sawNewline = false;
        continue;
      }
    }
    if (dotPrimary) {
      const dot = tryDotThis(tokens, i);
      if (dot) {
        out += emitRewrite(dot.code, lastSig, sawNewline);
        i = dot.end;
        lastSig = { type: "IdentifierName", value: tokens[i - 1].value };
        sawNewline = false;
        continue;
      }
    }
    // In a construct block, `[x]` after a previous statement must not
    // parse as member access (`"count"[x]`). Insert ASI when needed.
    if (
      inBlock &&
      tok.type === "Punctuator" &&
      tok.value === "[" &&
      needsLeadingSemi(lastSig, sawNewline)
    ) {
      out += ";";
    }
    out += tok.value;
    lastSig = tok;
    sawNewline = false;
    i++;
  }
  return out;
}

/**
 * Rewrite dialect tokens into valid JS IR (`__jsox_el` / `__jsox_scope`).
 * Leading `.ident` at a primary start becomes `this.ident`.
 */
export function splice(source) {
  if (typeof source !== "string") {
    throw new TypeError("splice() expects a string");
  }
  return spliceTokens([...jsTokens(source)], false);
}
