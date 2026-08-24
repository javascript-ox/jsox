const vscode = require("vscode");

const KIND = {
  method: vscode.CompletionItemKind.Method,
  field: vscode.CompletionItemKind.Field,
  keyword: vscode.CompletionItemKind.Keyword,
  class: vscode.CompletionItemKind.Class,
  variable: vscode.CompletionItemKind.Variable,
  function: vscode.CompletionItemKind.Function,
  text: vscode.CompletionItemKind.Text,
};

function fileNameOf(doc) {
  return doc.uri.scheme === "file" ? doc.uri.fsPath : doc.uri.toString();
}

function rangeFromOffsets(doc, start, end) {
  return new vscode.Range(doc.positionAt(start), doc.positionAt(Math.max(start, end)));
}

async function activate(context) {
  const output = vscode.window.createOutputChannel("JSOX");
  context.subscriptions.push(output);
  output.appendLine("activating in-process language service");

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = "jsox.showOutput";
  status.text = "$(sync~spin) JSOX";
  status.tooltip = "JSOX language service starting";
  status.show();
  context.subscriptions.push(status);

  context.subscriptions.push(
    vscode.commands.registerCommand("jsox.showOutput", () => output.show(true)),
  );

  let session;
  try {
    const mod = require("./dist/session.js");
    session = mod.createJsoxSession();
    output.appendLine("language service ready");
    status.text = "$(check) JSOX";
    status.tooltip = "JSOX language service ready — hover, complete, go to definition";
  } catch (err) {
    const msg = err?.stack || String(err);
    output.appendLine(msg);
    status.text = "$(error) JSOX";
    status.tooltip = "JSOX language service failed to start";
    vscode.window.showErrorMessage(`JSOX language service failed: ${err}`);
    return;
  }

  const selector = { language: "jsox" };
  const diagnostics = vscode.languages.createDiagnosticCollection("jsox");
  context.subscriptions.push(diagnostics);

  function sync(doc) {
    if (doc.languageId !== "jsox") return;
    const file = fileNameOf(doc);
    session.upsert(file, doc.getText());
    diagnostics.set(
      doc.uri,
      session.diagnostics(file).map((d) => {
        const item = new vscode.Diagnostic(
          rangeFromOffsets(doc, d.origStart, d.origEnd),
          d.message,
          d.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : vscode.DiagnosticSeverity.Warning,
        );
        item.source = "jsox";
        return item;
      }),
    );
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(sync),
    vscode.workspace.onDidChangeTextDocument((e) => sync(e.document)),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.languageId !== "jsox") return;
      session.remove(fileNameOf(doc));
      diagnostics.delete(doc.uri);
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(selector, {
      provideHover(doc, position) {
        sync(doc);
        const info = session.hover(fileNameOf(doc), doc.offsetAt(position));
        if (!info) return null;
        const md = new vscode.MarkdownString();
        md.appendCodeblock(info.text, "ts");
        if (info.docs) md.appendMarkdown("\n\n" + info.docs);
        return new vscode.Hover(md);
      },
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      selector,
      {
        provideCompletionItems(doc, position) {
          sync(doc);
          const items = session.completions(
            fileNameOf(doc),
            doc.offsetAt(position),
            doc.getText(),
          );
          return items.map((item) => {
            const out = new vscode.CompletionItem(
              item.label,
              KIND[item.kind] ?? vscode.CompletionItemKind.Text,
            );
            out.detail = item.detail;
            out.sortText = item.sortText;
            out.insertText = item.insertText ?? item.label;
            return out;
          });
        },
      },
      ".",
      "<",
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition(doc, position) {
        sync(doc);
        const defs = session.definition(fileNameOf(doc), doc.offsetAt(position));
        return defs.map((def) => {
          if (def.sameFile) {
            return new vscode.Location(doc.uri, rangeFromOffsets(doc, def.origStart, def.origEnd));
          }
          return new vscode.Location(
            vscode.Uri.parse(def.uri),
            new vscode.Range(
              new vscode.Position(def.start.line, def.start.character),
              new vscode.Position(def.end.line, def.end.character),
            ),
          );
        });
      },
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerSignatureHelpProvider(
      selector,
      {
        provideSignatureHelp(doc, position) {
          sync(doc);
          const help = session.signatures(fileNameOf(doc), doc.offsetAt(position));
          if (!help) return null;
          const out = new vscode.SignatureHelp();
          out.activeSignature = help.activeSignature;
          out.activeParameter = help.activeParameter;
          out.signatures = help.signatures.map((sig) => {
            const item = new vscode.SignatureInformation(sig.label, sig.documentation);
            item.parameters = sig.parameters.map(
              (p) => new vscode.ParameterInformation(p.label, p.documentation),
            );
            return item;
          });
          return out;
        },
      },
      "(",
      ",",
    ),
  );

  for (const doc of vscode.workspace.textDocuments) sync(doc);
}

function deactivate() {}

module.exports = { activate, deactivate };
