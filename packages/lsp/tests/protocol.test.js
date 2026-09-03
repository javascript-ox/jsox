import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));

function startServer() {
  const child = spawn(process.execPath, [cli], {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: path.dirname(path.dirname(cli)),
  });
  let buf = Buffer.alloc(0);
  const pending = new Map();
  const notifications = [];
  let nextId = 1;
  let notifyWait = null;

  child.stderr.on("data", () => {});
  child.stdout.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = buf.subarray(0, headerEnd).toString("utf8");
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) break;
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      if (buf.length < bodyStart + len) break;
      const body = buf.subarray(bodyStart, bodyStart + len).toString("utf8");
      buf = buf.subarray(bodyStart + len);
      const msg = JSON.parse(body);
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(Object.assign(new Error(msg.error.message), msg.error));
        else resolve(msg.result);
      } else if (msg.method) {
        notifications.push(msg);
        notifyWait?.();
      }
    }
  });

  function send(obj) {
    const json = JSON.stringify(obj);
    child.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  }

  return {
    child,
    request(method, params) {
      const id = nextId++;
      send({ jsonrpc: "2.0", id, method, params });
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    notify(method, params) {
      send({ jsonrpc: "2.0", method, params });
    },
    waitFor(method, timeoutMs = 8000) {
      const found = notifications.find((n) => n.method === method);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), timeoutMs);
        notifyWait = () => {
          const msg = notifications.find((n) => n.method === method);
          if (msg) {
            clearTimeout(t);
            notifyWait = null;
            resolve(msg);
          }
        };
      });
    },
    async shutdown() {
      await this.request("shutdown", null);
      this.notify("exit", undefined);
      await new Promise((resolve) => {
        const t = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 2000);
        child.on("exit", () => {
          clearTimeout(t);
          resolve();
        });
      });
    },
  };
}

describe("jsox-lsp protocol", () => {
  it("initializes, hovers a tag capture, and completes this-shorthand", async () => {
    const server = startServer();
    try {
      const init = await server.request("initialize", {
        processId: process.pid,
        rootUri: null,
        capabilities: {},
        clientInfo: { name: "jsox-lsp-test" },
      });
      assert.equal(init.serverInfo?.name, "JSOX");
      assert.equal(init.serverInfo?.version, "0.2.1");
      assert.equal(init.capabilities.hoverProvider, true);
      assert.equal(init.capabilities.completionProvider.triggerCharacters.includes("."), true);
      assert.deepEqual(init.capabilities.semanticTokensProvider.full, { delta: false });
      server.notify("initialized", {});

      const uri = "file:///tmp/protocol-view.jsox";
      const text = `export function view() {
  const el = <button> {
    .type = "button"
  }
  return el;
}
`;
      server.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: "jsox", version: 1, text },
      });

      await server.waitFor("textDocument/publishDiagnostics");

      const hover = await server.request("textDocument/hover", {
        textDocument: { uri },
        position: { line: 1, character: 8 },
      });
      const hoverText = hover?.contents?.value ?? "";
      assert.match(hoverText, /HTMLButtonElement/);

      const completions = await server.request("textDocument/completion", {
        textDocument: { uri },
        position: { line: 2, character: 6 },
      });
      const labels = (Array.isArray(completions) ? completions : completions?.items ?? []).map(
        (c) => c.label,
      );
      assert.ok(labels.includes("className") || labels.includes("type") || labels.includes("addEventListener"));

      const semantic = await server.request("textDocument/semanticTokens/full", {
        textDocument: { uri },
      });
      assert.ok(semantic.data.length > 0);

      const definitions = await server.request("textDocument/definition", {
        textDocument: { uri },
        position: { line: 1, character: 15 },
      });
      assert.ok(definitions.length);
      assert.match(definitions[0].uri, /lib\.dom\.d\.ts$/);
    } finally {
      await server.shutdown();
    }
  });

  it("loads namespace typing from the workspace config", async (t) => {
    const dir = await mkdtemp(path.join(tmpdir(), "jsox-lsp-config-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    await writeFile(
      path.join(dir, "jsox.config.js"),
      `module.exports = {
  defaultNamespace: "react",
  namespaceHandlers: {
    react(tag) { return "new " + tag + "()"; }
  }
};
`,
    );

    const server = startServer();
    try {
      await server.request("initialize", {
        processId: process.pid,
        rootUri: pathToFileURL(dir).href,
        capabilities: {},
        clientInfo: { name: "jsox-lsp-config-test" },
      });
      server.notify("initialized", {});

      const file = path.join(dir, "view.jsox");
      const uri = pathToFileURL(file).href;
      const text = `class MyReactElement {
  activate() {}
}
const element = <MyReactElement> {
  .activate()
};
`;
      server.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: "jsox", version: 1, text },
      });
      const diagnostics = await server.waitFor("textDocument/publishDiagnostics");
      assert.deepEqual(diagnostics.params.diagnostics, []);

      const hover = await server.request("textDocument/hover", {
        textDocument: { uri },
        position: { line: 3, character: 7 },
      });
      assert.match(hover?.contents?.value ?? "", /MyReactElement/);
    } finally {
      await server.shutdown();
    }
  });
});
