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

function takeBalanced(tokens, start, open, close, recover = false) {
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
  if (recover) {
    return {
      inner: tokens.slice(start + 1),
      end: tokens.length,
      unclosed: true,
    };
  }
  throw new SyntaxError(`Unmatched '${open}' in dialect source`);
}

function withOffsets(tokens) {
  let offset = 0;
  return tokens.map((t) => {
    const start = offset;
    offset += t.value.length;
    return { ...t, start, end: offset };
  });
}

function shiftMaps(maps, genDelta) {
  if (!genDelta) return maps;
  return maps.map((m) => ({
    origStart: m.origStart,
    origEnd: m.origEnd,
    genStart: m.genStart + genDelta,
    genEnd: m.genEnd + genDelta,
  }));
}

function tryTag(tokens, i, opts) {
  if (tokens[i]?.value !== "<") return null;
  // Keep tag delimiters contiguous so `< b >` remains a JS comparison.
  let j = i + 1;
  if (!isIdent(tokens[j])) return null;
  let name = tokens[j].value;
  j++;
  while (tokens[j]?.value === "-" && isIdent(tokens[j + 1])) {
    name += "-" + tokens[j + 1].value;
    j += 2;
  }
  if (tokens[j]?.value !== ">") return null;
  j++;
  const k = skipWs(tokens, j);
  if (tokens[k]?.value === "{") {
    const block = takeBalanced(tokens, k, "{", "}", opts?.recover);
    const body = spliceTokens(block.inner, true, opts);
    const prefix = `${EL}(${JSON.stringify(name)}, function(){`;
    const code = `${prefix}${body.code}})`;
    return {
      code,
      end: block.end,
      origStart: tokens[i].start,
      origEnd: tokens[block.end - 1].end,
      maps: shiftMaps(body.maps, prefix.length),
    };
  }
  const code = `${EL}(${JSON.stringify(name)})`;
  return {
    code,
    end: j,
    origStart: tokens[i].start,
    origEnd: tokens[j - 1].end,
    maps: [],
  };
}

function tryScope(tokens, i, opts) {
  if (tokens[i]?.value !== "[") return null;
  let brackets;
  try {
    brackets = takeBalanced(tokens, i, "[", "]", opts?.recover);
  } catch {
    return null;
  }
  const k = skipWs(tokens, brackets.end);
  if (tokens[k]?.value !== "{") return null;
  const block = takeBalanced(tokens, k, "{", "}", opts?.recover);
  const inner = spliceTokens(brackets.inner, false, opts);
  const body = spliceTokens(block.inner, true, opts);
  const expr = inner.code.trim().length ? inner.code.trim() : "undefined";
  const prefix = `${SCOPE}((${expr}), function(){`;
  const code = `${prefix}${body.code}})`;
  return {
    code,
    end: block.end,
    origStart: tokens[i].start,
    origEnd: tokens[block.end - 1].end,
    maps: [
      ...shiftMaps(inner.maps, `${SCOPE}((`.length),
      ...shiftMaps(body.maps, prefix.length),
    ],
  };
}

function tryDotThis(tokens, i, opts) {
  if (tokens[i]?.value !== ".") return null;
  if (isIdent(tokens[i + 1])) {
    return {
      code: `this.${tokens[i + 1].value}`,
      end: i + 2,
      origStart: tokens[i].start,
      origEnd: tokens[i + 1].end,
      maps: [],
    };
  }
  if (opts?.incompleteThis) {
    return {
      code: "this.",
      end: i + 1,
      origStart: tokens[i].start,
      origEnd: tokens[i].end,
      maps: [],
    };
  }
  return null;
}

function spliceTokens(tokens, inBlock, opts = {}) {
  let i = 0;
  let lastSig = null;
  let sawNewline = false;
  let out = "";
  const maps = [];

  function emit(text, origStart, origEnd, innerMaps = []) {
    const genStart = out.length;
    out += text;
    const genEnd = out.length;
    maps.push({ origStart, origEnd, genStart, genEnd });
    for (const m of innerMaps) {
      maps.push({
        origStart: m.origStart,
        origEnd: m.origEnd,
        genStart: genStart + m.genStart,
        genEnd: genStart + m.genEnd,
      });
    }
  }

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.type === "LineTerminatorSequence") {
      emit(tok.value, tok.start, tok.end);
      sawNewline = true;
      i++;
      continue;
    }
    if (isWs(tok)) {
      emit(tok.value, tok.start, tok.end);
      i++;
      continue;
    }
    const primary = canStartPrimary(lastSig, sawNewline);
    const dotPrimary =
      canStartPrimary(lastSig, false) || (inBlock && sawNewline);
    if (primary) {
      const tag = tryTag(tokens, i, opts);
      if (tag) {
        const rewritten = emitRewrite(tag.code, lastSig, sawNewline);
        const extra = rewritten.length - tag.code.length;
        emit(rewritten, tag.origStart, tag.origEnd, extra ? shiftMaps(tag.maps, extra) : tag.maps);
        i = tag.end;
        lastSig = { type: "Punctuator", value: ")" };
        sawNewline = false;
        continue;
      }
      const scope = tryScope(tokens, i, opts);
      if (scope) {
        const rewritten = emitRewrite(scope.code, lastSig, sawNewline);
        const extra = rewritten.length - scope.code.length;
        emit(rewritten, scope.origStart, scope.origEnd, extra ? shiftMaps(scope.maps, extra) : scope.maps);
        i = scope.end;
        lastSig = { type: "Punctuator", value: ")" };
        sawNewline = false;
        continue;
      }
    }
    if (dotPrimary) {
      const dot = tryDotThis(tokens, i, opts);
      if (dot) {
        const rewritten = emitRewrite(dot.code, lastSig, sawNewline);
        const genStart = out.length;
        out += rewritten;
        const prefix = rewritten.startsWith(";") ? 1 : 0;
        maps.push({
          origStart: dot.origStart,
          origEnd: dot.origEnd,
          genStart: genStart + prefix + 4,
          genEnd: out.length,
        });
        i = dot.end;
        lastSig = { type: "IdentifierName", value: tokens[i - 1].value };
        sawNewline = false;
        continue;
      }
    }
    if (
      inBlock &&
      tok.type === "Punctuator" &&
      tok.value === "[" &&
      needsLeadingSemi(lastSig, sawNewline)
    ) {
      out += ";";
    }
    emit(tok.value, tok.start, tok.end);
    lastSig = tok;
    sawNewline = false;
    i++;
  }
  return { code: out, maps };
}

/**
 * Rewrite dialect tokens into valid JS IR (`__jsox_el` / `__jsox_scope`).
 * Leading `.ident` at a primary start becomes `this.ident`.
 */
export function splice(source) {
  return spliceWithMap(source).code;
}

/**
 * Like splice(), plus orig↔generated offset maps for language services.
 * @returns {{ code: string, maps: { origStart: number, origEnd: number, genStart: number, genEnd: number }[] }}
 */
export function spliceWithMap(source, opts = {}) {
  if (typeof source !== "string") {
    throw new TypeError("splice() expects a string");
  }
  return spliceTokens(withOffsets([...jsTokens(source)]), false, opts);
}

/** Map an original source offset into spliced JS. */
export function origToGen(maps, offset) {
  let best = null;
  for (const m of maps) {
    if (offset >= m.origStart && offset < m.origEnd) {
      if (!best || m.origEnd - m.origStart < best.origEnd - best.origStart) best = m;
    }
  }
  if (!best) return offset;
  const olen = best.origEnd - best.origStart;
  if (olen <= 0) return best.genStart;
  const t = (offset - best.origStart) / olen;
  return Math.round(best.genStart + t * (best.genEnd - best.genStart));
}

/** Map a spliced-JS offset back to original source. */
export function genToOrig(maps, offset) {
  let best = null;
  for (const m of maps) {
    if (offset >= m.genStart && offset < m.genEnd) {
      if (!best || m.genEnd - m.genStart < best.genEnd - best.genStart) best = m;
    }
  }
  if (!best) return offset;
  const glen = best.genEnd - best.genStart;
  if (glen <= 0) return best.origStart;
  const t = (offset - best.genStart) / glen;
  return Math.round(best.origStart + t * (best.origEnd - best.origStart));
}
