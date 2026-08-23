#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { compile } from "./compile.js";
import { loadConfig } from "./config.js";

function usage() {
  console.error(`Usage:
  jsox compile <file.jsox> [-o <file.js>] [--config <dir>]

Compile a JSOX file to plain JavaScript.
Writes to stdout if -o is omitted.`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const out = { cmd: args[0], file: null, output: null, configDir: process.cwd() };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "-o" || a === "--output") {
      out.output = args[++i];
    } else if (a === "--config") {
      out.configDir = resolve(args[++i]);
    } else if (a === "-h" || a === "--help") {
      out.help = true;
    } else if (!a.startsWith("-") && !out.file) {
      out.file = a;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return out;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv);
  } catch (err) {
    console.error(err.message);
    usage();
    process.exitCode = 1;
    return;
  }
  if (opts.help || !opts.cmd) {
    usage();
    return;
  }
  if (opts.cmd !== "compile" || !opts.file) {
    usage();
    process.exitCode = 1;
    return;
  }
  const abs = resolve(opts.file);
  const source = await readFile(abs, "utf8");
  const config = await loadConfig(opts.configDir);
  const { code } = compile(source, config);
  if (opts.output) {
    await writeFile(resolve(opts.output), code, "utf8");
  } else {
    process.stdout.write(code);
    if (!code.endsWith("\n")) process.stdout.write("\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
