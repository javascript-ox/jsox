# @jsox/lsp

Language server for `.jsox` files.

JSOX is treated as JavaScript plus dialect extras: the server splices source to JS, runs TypeScript’s JS language service, and maps results back. `<button> { .type }` is typed as `HTMLButtonElement` / `this`.

Speaks LSP over **stdio**.

```
node packages/lsp/src/cli.js
```

Or `npx jsox-lsp` after the workspace is installed (`npm run lsp` from the repo root).

## Capabilities

- Completions (`.` on `this`/elements, `<` for HTML tags)
- Hover
- Go to definition (including DOM lib types)
- Signature help
- Diagnostics from TypeScript `checkJs`

Syntax coloring stays with the editor (VS Code TextMate grammar). The server does intelligence.

## VS Code

The `plugins/vscode` extension launches this server. From the repo, Run and Debug → **JSOX: VS Code Extension**, or:

```
code --install-extension plugins/vscode
```

(open this folder as the workspace so the extension can find `packages/lsp`).

Optional setting: `jsox.lsp.path` — absolute path to `cli.js` or the `jsox-lsp` binary.

## IntelliJ / WebStorm

Install `plugins/intellij/build/distributions/jsox-intellij-2.0.0.zip` (Settings → Plugins → Install Plugin from Disk). That plugin registers `.jsox` as its own file type and starts this language server through IntelliJ’s built-in LSP API. It does **not** parse JSOX as JavaScript.

Requires IntelliJ IDEA Ultimate or WebStorm (the LSP API is not in Community). Settings → JSOX can override the Node binary and server script. Uninstall any 1.x JSOX plugin first.
