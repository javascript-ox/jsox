import ts from "typescript";
import { pathToFileURL } from "node:url";
import { createJsService } from "./js-service.js";
import { tagCompletions } from "./tags.js";

function offsetToPos(text, offset) {
  const cap = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  let character = 0;
  for (let i = 0; i < cap; i++) {
    if (text[i] === "\n") {
      line++;
      character = 0;
    } else {
      character++;
    }
  }
  return { line, character };
}

function completionKind(kind) {
  switch (kind) {
    case ts.ScriptElementKind.functionElement:
    case ts.ScriptElementKind.memberFunctionElement:
      return "method";
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.variableElement:
    case ts.ScriptElementKind.constElement:
    case ts.ScriptElementKind.letElement:
      return "field";
    case ts.ScriptElementKind.keyword:
      return "keyword";
    case ts.ScriptElementKind.classElement:
      return "class";
    default:
      return "text";
  }
}

/**
 * Editor-agnostic JSOX intelligence. Positions are original-source offsets.
 */
export function createJsoxSession() {
  const js = createJsService();

  function ensure(fileName, source) {
    const prev = js.get(fileName);
    if (prev && prev.source === source && !prev.error) return prev;
    return js.upsert(fileName, source);
  }

  function mapped(fileName, orig) {
    const entry = js.get(fileName);
    if (!entry || entry.error) return null;
    return { entry, gen: js.origOffsetToGen(entry, orig) };
  }

  return {
    upsert: ensure,
    remove(fileName) {
      js.remove(fileName);
    },

    hover(fileName, orig) {
      const at = mapped(fileName, orig);
      if (!at) return null;
      const info = js.quickInfo(fileName, at.gen);
      if (!info) return null;
      return {
        text: ts.displayPartsToString(info.displayParts),
        docs: ts.displayPartsToString(info.documentation),
      };
    },

    completions(fileName, orig, source) {
      const tags = tagCompletions(source, orig);
      if (tags?.length) {
        return tags.map((t) => ({
          label: t.label,
          kind: "class",
          detail: t.detail,
          insertText: t.insertText,
        }));
      }
      const at = mapped(fileName, orig);
      if (!at) return [];
      const info = js.completions(fileName, at.gen);
      if (!info?.entries?.length) return [];
      return info.entries
        .filter((item) => !item.name.startsWith("__jsox_"))
        .map((item) => ({
          label: item.name,
          kind: completionKind(item.kind),
          detail: item.kind,
          sortText: item.sortText,
          insertText: item.name,
        }));
    },

    definition(fileName, orig) {
      const at = mapped(fileName, orig);
      if (!at) return [];
      const defs = js.definition(fileName, at.gen);
      if (!defs?.length) return [];
      const virtual = js.tsName(fileName);
      return defs
        .map((def) => {
          if (def.fileName === virtual) {
            const start = js.genOffsetToOrig(at.entry, def.textSpan.start);
            const end = js.genOffsetToOrig(
              at.entry,
              def.textSpan.start + def.textSpan.length,
            );
            return {
              sameFile: true,
              origStart: Math.min(start, end),
              origEnd: Math.max(start, end),
            };
          }
          const target = js.definitionToOriginal(def);
          const text = ts.sys.readFile(target.fileName);
          if (text == null) return null;
          return {
            sameFile: false,
            fileName: target.fileName,
            uri: pathToFileURL(target.fileName).href,
            start: offsetToPos(text, target.textSpan.start),
            end: offsetToPos(text, target.textSpan.start + target.textSpan.length),
          };
        })
        .filter(Boolean);
    },

    signatures(fileName, orig) {
      const at = mapped(fileName, orig);
      if (!at) return null;
      const help = js.signatures(fileName, at.gen);
      if (!help) return null;
      return {
        activeSignature: help.selectedItemIndex,
        activeParameter: help.argumentIndex,
        signatures: help.items.map((item) => {
          const sep = ts.displayPartsToString(item.separatorDisplayParts);
          const paramsLabel = item.parameters
            .map((p) => ts.displayPartsToString(p.displayParts))
            .join(sep);
          return {
            label:
              ts.displayPartsToString(item.prefixDisplayParts) +
              paramsLabel +
              ts.displayPartsToString(item.suffixDisplayParts),
            documentation: ts.displayPartsToString(item.documentation),
            parameters: item.parameters.map((p) => ({
              label: ts.displayPartsToString(p.displayParts),
              documentation: ts.displayPartsToString(p.documentation),
            })),
          };
        }),
      };
    },

    diagnostics(fileName) {
      const entry = js.get(fileName);
      if (!entry) return [];
      if (entry.error) {
        return [
          {
            origStart: 0,
            origEnd: Math.min(1, entry.source?.length ?? 0),
            message: entry.error.message || String(entry.error),
            severity: "error",
          },
        ];
      }
      const out = [];
      for (const diag of js.diagnostics(fileName)) {
        if (
          diag.category !== ts.DiagnosticCategory.Error &&
          diag.category !== ts.DiagnosticCategory.Warning
        ) {
          continue;
        }
        const start = diag.start ?? 0;
        if (start < entry.preamble) continue;
        const origStart = js.genOffsetToOrig(entry, start);
        const origEnd = js.genOffsetToOrig(entry, start + (diag.length ?? 1));
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        if (message.includes("__jsox_el") || message.includes("__jsox_scope")) continue;
        out.push({
          origStart: Math.min(origStart, origEnd),
          origEnd: Math.max(origStart, origEnd),
          message,
          severity:
            diag.category === ts.DiagnosticCategory.Error ? "error" : "warning",
        });
      }
      return out;
    },
  };
}
