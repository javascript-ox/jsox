import ts from "typescript";
import { spliceWithMap, origToGen, genToOrig } from "@jsox/compiler/splice";
import { PREAMBLE } from "./preamble.js";

function toVirtual(source) {
  const { code, maps } = spliceWithMap(source, { incompleteThis: true, recover: true });
  return { code: PREAMBLE + code, maps, preamble: PREAMBLE.length };
}

function tsName(fileName) {
  return fileName.endsWith(".jsox") ? `${fileName}.js` : fileName;
}

function origOffsetToGen(entry, offset) {
  return entry.preamble + origToGen(entry.maps, offset);
}

function genOffsetToOrig(entry, offset) {
  if (offset < entry.preamble) return 0;
  return genToOrig(entry.maps, offset - entry.preamble);
}

function loadDisk(fileName) {
  if (/\.css(\.js)?$/.test(fileName)) return "export {};\n";
  const raw = ts.sys.readFile(fileName);
  if (raw == null) return undefined;
  if (fileName.endsWith(".jsox")) {
    try {
      return PREAMBLE + spliceWithMap(raw, { incompleteThis: true, recover: true }).code;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function createJsService() {
  /** @type {Map<string, { version: number, source: string, code: string, maps: object[], preamble: number }>} */
  const docs = new Map();
  let projectVersion = 0;
  let currentDir = ts.sys.getCurrentDirectory();

  const compilerOptions = {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    skipLibCheck: true,
    maxNodeModuleJsDepth: 0,
  };

  const host = {
    getCompilationSettings: () => compilerOptions,
    getProjectVersion: () => String(projectVersion),
    getScriptFileNames: () => [...docs.keys()],
    getScriptVersion: (fileName) => String(docs.get(fileName)?.version ?? 0),
    getScriptSnapshot: (fileName) => {
      const doc = docs.get(fileName);
      if (doc) return ts.ScriptSnapshot.fromString(doc.code);
      const raw = loadDisk(fileName);
      if (raw == null) return undefined;
      return ts.ScriptSnapshot.fromString(raw);
    },
    getCurrentDirectory: () => currentDir,
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    fileExists: (fileName) => docs.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) => {
      const doc = docs.get(fileName);
      if (doc) return doc.code;
      return loadDisk(fileName);
    },
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };

  const service = ts.createLanguageService(host);

  function upsert(fileName, source) {
    const name = tsName(fileName);
    let virtual;
    try {
      virtual = toVirtual(source);
    } catch (err) {
      const prev = docs.get(name);
      docs.set(name, {
        version: (prev?.version ?? 0) + 1,
        source,
        code: PREAMBLE + source,
        maps: [],
        preamble: PREAMBLE.length,
        error: err,
        originalName: fileName,
      });
      projectVersion++;
      return docs.get(name);
    }
    const slash = Math.max(fileName.lastIndexOf("/"), fileName.lastIndexOf("\\"));
    if (slash > 0) currentDir = fileName.slice(0, slash);
    const prev = docs.get(name);
    docs.set(name, {
      version: (prev?.version ?? 0) + 1,
      source,
      originalName: fileName,
      ...virtual,
    });
    projectVersion++;
    return docs.get(name);
  }

  function remove(fileName) {
    if (docs.delete(tsName(fileName))) projectVersion++;
  }

  function get(fileName) {
    return docs.get(tsName(fileName));
  }

  function completions(fileName, genOffset) {
    return service.getCompletionsAtPosition(tsName(fileName), genOffset, {
      includeExternalModuleExports: true,
      includeCompletionsWithInsertText: true,
      includeCompletionsForModuleExports: true,
      includeAutomaticOptionalChainCompletions: true,
    });
  }

  function quickInfo(fileName, genOffset) {
    return service.getQuickInfoAtPosition(tsName(fileName), genOffset);
  }

  function definition(fileName, genOffset) {
    return service.getDefinitionAtPosition(tsName(fileName), genOffset);
  }

  function signatures(fileName, genOffset) {
    return service.getSignatureHelpItems(tsName(fileName), genOffset, {});
  }

  function diagnostics(fileName) {
    const name = tsName(fileName);
    return [
      ...service.getSyntacticDiagnostics(name),
      ...service.getSemanticDiagnostics(name),
    ];
  }

  return {
    upsert,
    remove,
    get,
    origOffsetToGen,
    genOffsetToOrig,
    completions,
    quickInfo,
    definition,
    signatures,
    diagnostics,
    tsName,
  };
}
