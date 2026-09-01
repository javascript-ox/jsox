import {
  createConnection,
  TextDocuments,
  TextDocumentSyncKind,
  CompletionItemKind,
  DiagnosticSeverity,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { createJsService } from "./js-service.js";
import { tagCompletions } from "./tags.js";

export function start() {
  const connection = createConnection(process.stdin, process.stdout);
  const documents = new TextDocuments(TextDocument);
  const js = createJsService();

  function pathOf(uri) {
    if (uri.startsWith("file:")) return fileURLToPath(uri);
    return uri;
  }

  function posAt(doc, offset) {
    return doc.positionAt(Math.max(0, Math.min(offset, doc.getText().length)));
  }

  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { triggerCharacters: [".", "<"] },
      hoverProvider: true,
      definitionProvider: true,
      signatureHelpProvider: { triggerCharacters: ["(", ","] },
    },
    serverInfo: { name: "JSOX", version: "0.1.0" },
  }));

  const diagTimers = new Map();

  documents.onDidOpen((e) => {
    js.upsert(pathOf(e.document.uri), e.document.getText());
    scheduleDiags(e.document);
  });
  documents.onDidChangeContent((e) => {
    js.upsert(pathOf(e.document.uri), e.document.getText());
    scheduleDiags(e.document);
  });
  documents.onDidClose((e) => {
    const uri = e.document.uri;
    const timer = diagTimers.get(uri);
    if (timer) clearTimeout(timer);
    diagTimers.delete(uri);
    js.remove(pathOf(uri));
    connection.sendDiagnostics({ uri, diagnostics: [] });
  });

  function scheduleDiags(doc) {
    const uri = doc.uri;
    const prev = diagTimers.get(uri);
    if (prev) clearTimeout(prev);
    diagTimers.set(
      uri,
      setTimeout(() => {
        diagTimers.delete(uri);
        publishDiags(doc);
      }, 200),
    );
  }

  function publishDiags(doc) {
    const fileName = pathOf(doc.uri);
    const entry = js.get(fileName) || js.upsert(fileName, doc.getText());
    const diagnostics = [];

    if (entry.error) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: { start: posAt(doc, 0), end: posAt(doc, Math.min(1, doc.getText().length)) },
        message: entry.error.message || String(entry.error),
        source: "jsox",
      });
    } else {
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
        diagnostics.push({
          severity:
            diag.category === ts.DiagnosticCategory.Error
              ? DiagnosticSeverity.Error
              : DiagnosticSeverity.Warning,
          range: {
            start: posAt(doc, Math.min(origStart, origEnd)),
            end: posAt(doc, Math.max(origStart, origEnd)),
          },
          message,
          source: "jsox",
        });
      }
    }

    connection.sendDiagnostics({ uri: doc.uri, diagnostics });
  }

  connection.onCompletion((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const orig = doc.offsetAt(params.position);
    const tags = tagCompletions(doc.getText(), orig);
    if (tags?.length) return tags;
    const fileName = pathOf(doc.uri);
    const entry = js.get(fileName) || js.upsert(fileName, doc.getText());
    if (!entry || entry.error) return null;
    const gen = js.origOffsetToGen(entry, orig);
    const info = js.completions(fileName, gen);
    if (!info?.entries?.length) return null;
    return {
      isIncomplete: false,
      items: info.entries
        .filter((item) => !item.name.startsWith("__jsox_"))
        .map((item) => ({
          label: item.name,
          kind: completionKind(item.kind),
          sortText: item.sortText,
          detail: item.kind,
          filterText: item.name,
          insertText: item.name,
        })),
    };
  });

  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const fileName = pathOf(doc.uri);
    const entry = js.get(fileName);
    if (!entry || entry.error) return null;
    const orig = doc.offsetAt(params.position);
    const gen = js.origOffsetToGen(entry, orig);
    const info = js.quickInfo(fileName, gen);
    if (!info) return null;
    const text = ts.displayPartsToString(info.displayParts);
    const docs = ts.displayPartsToString(info.documentation);
    return {
      contents: {
        kind: "markdown",
        value: "```ts\n" + text + "\n```" + (docs ? "\n\n" + docs : ""),
      },
    };
  });

  connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const fileName = pathOf(doc.uri);
    const entry = js.get(fileName);
    if (!entry || entry.error) return null;
    const orig = doc.offsetAt(params.position);
    const gen = js.origOffsetToGen(entry, orig);
    const defs = js.definition(fileName, gen);
    if (!defs?.length) return null;
    const virtual = js.tsName(fileName);
    return defs
      .map((def) => {
        if (def.fileName === virtual) {
          const start = js.genOffsetToOrig(entry, def.textSpan.start);
          const end = js.genOffsetToOrig(entry, def.textSpan.start + def.textSpan.length);
          return {
            uri: params.textDocument.uri,
            range: {
              start: posAt(doc, Math.min(start, end)),
              end: posAt(doc, Math.max(start, end)),
            },
          };
        }
        const target = js.definitionToOriginal(def);
        const text = ts.sys.readFile(target.fileName);
        if (text == null) return null;
        const start = offsetToPos(text, target.textSpan.start);
        const end = offsetToPos(text, target.textSpan.start + target.textSpan.length);
        return {
          uri: pathToFileURL(target.fileName).href,
          range: { start, end },
        };
      })
      .filter(Boolean);
  });

  connection.onSignatureHelp((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    const fileName = pathOf(doc.uri);
    const entry = js.get(fileName);
    if (!entry || entry.error) return null;
    const orig = doc.offsetAt(params.position);
    const gen = js.origOffsetToGen(entry, orig);
    const help = js.signatures(fileName, gen);
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
  });

  documents.listen(connection);
  connection.listen();
  return connection;
}

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
      return CompletionItemKind.Method;
    case ts.ScriptElementKind.memberVariableElement:
    case ts.ScriptElementKind.variableElement:
      return CompletionItemKind.Field;
    case ts.ScriptElementKind.keyword:
      return CompletionItemKind.Keyword;
    case ts.ScriptElementKind.classElement:
      return CompletionItemKind.Class;
    default:
      return CompletionItemKind.Text;
  }
}
