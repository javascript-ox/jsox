import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig, loadConfig, normalizeConfig } from "../src/config.js";

async function tempConfigDir(t) {
  const dir = await mkdtemp(join(tmpdir(), "jsox-config-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

describe("loadConfig", () => {
  it("uses defaults when the config file is absent", async (t) => {
    const dir = await tempConfigDir(t);
    const config = await loadConfig(dir);
    assert.deepEqual(config.childMethods, defaultConfig.childMethods);
    assert.equal(config.childHelperName, defaultConfig.childHelperName);
    assert.equal(config.strict, defaultConfig.strict);
    assert.equal(config.defaultNamespace, "html");
    assert.equal(typeof config.tagHandlers.html, "function");
    assert.equal(typeof config.tagHandlers.svg, "function");
  });

  it("propagates a missing dependency from an existing config", async (t) => {
    const dir = await tempConfigDir(t);
    await writeFile(
      join(dir, "jsox.config.js"),
      `import "jsox-package-that-does-not-exist";\nexport default {};\n`,
    );

    await assert.rejects(loadConfig(dir), (err) => {
      assert.equal(err.code, "ERR_MODULE_NOT_FOUND");
      assert.match(err.message, /jsox-package-that-does-not-exist/);
      return true;
    });
  });

  it("validates tag handler configuration", () => {
    assert.throws(
      () => normalizeConfig({ tagHandlers: { "not:valid": () => "x" } }),
      /Invalid tag namespace/,
    );
    assert.throws(
      () => normalizeConfig({ tagHandlers: { view: "makeView" } }),
      /config\.tagHandlers\.view must be a function/,
    );
    assert.throws(
      () => normalizeConfig({ defaultNamespace: "view" }),
      /unknown tag namespace "view"/,
    );
  });
});
