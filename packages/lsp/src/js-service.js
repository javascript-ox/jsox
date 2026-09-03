import ts from "typescript";
import { spliceWithMap, origToGen, origCursorToGen, genToOrig } from "@js-ox/compiler/splice";
import { normalizeConfig } from "@js-ox/compiler";
import { PREAMBLE } from "./preamble.js";

function typeWitness(config, explicitNamespace, tag) {
  const namespace = explicitNamespace ?? config.defaultNamespace;
  const handler = config.namespaceHandlers[namespace];
  if (!handler) return null;
  const factory = typeof handler === "function" ? handler : handler.create;
  const context = {
    namespace,
    explicitNamespace,
    qualifiedName: `${namespace}:${tag}`,
  };
  const target = factory(tag, context);
  if (typeof handler !== "object") return target;
  const typeExpression = (hint) => {
    const value = typeof hint === "function" ? hint(tag, context) : hint;
    if (typeof value !== "string" || !value.trim()) return null;
    return `/** @type {${value}} */ (/** @type {unknown} */ (undefined))`;
  };
  const targetWitness = typeExpression(handler.types?.target) ?? target;
  if (!handler.finalize) {
    return typeExpression(handler.types?.result) ?? targetWitness;
  }
  const result = typeExpression(handler.types?.result) ??
    handler.finalize(target, { tag, ...context });
  return {
    target: targetWitness,
    result,
  };
}

function toVirtual(source, config) {
  const { code, maps } = spliceWithMap(source, {
    incompleteThis: true,
    recover: true,
    typeWitness: (namespace, tag) => typeWitness(config, namespace, tag),
  });
  return { code: PREAMBLE + code, maps, preamble: PREAMBLE.length };
}

function tsName(fileName) {
  return fileName.endsWith(".jsox") ? `${fileName}.js` : fileName;
}

function physicalJsoxName(fileName) {
  return fileName.endsWith(".jsox.js") ? fileName.slice(0, -3) : null;
}

function diskName(fileName) {
  const physical = physicalJsoxName(fileName);
  return physical && ts.sys.fileExists(physical) ? physical : fileName;
}

function origOffsetToGen(entry, offset, cursor = false) {
  return entry.preamble + (cursor
    ? origCursorToGen(entry.maps, offset)
    : origToGen(entry.maps, offset));
}

function genOffsetToOrig(entry, offset) {
  if (offset < entry.preamble) return 0;
  return genToOrig(entry.maps, offset - entry.preamble);
}

function loadDisk(fileName, config) {
  if (/\.css(\.js)?$/.test(fileName)) return "export {};\n";
  const raw = ts.sys.readFile(fileName);
  if (raw == null) return undefined;
  if (fileName.endsWith(".jsox")) {
    try {
      return toVirtual(raw, config).code;
    } catch {
      return raw;
    }
  }
  return raw;
}

export function createJsService(configInput = {}) {
  const config = normalizeConfig(configInput);
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
      const raw = loadDisk(diskName(fileName), config);
      if (raw == null) return undefined;
      return ts.ScriptSnapshot.fromString(raw);
    },
    getCurrentDirectory: () => currentDir,
    getDefaultLibFileName: (opts) => ts.getDefaultLibFilePath(opts),
    fileExists: (fileName) =>
      docs.has(fileName) || ts.sys.fileExists(fileName) || diskName(fileName) !== fileName,
    readFile: (fileName) => {
      const doc = docs.get(fileName);
      if (doc) return doc.code;
      return loadDisk(diskName(fileName), config);
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
      virtual = toVirtual(source, config);
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
    const name = tsName(fileName);
    const entry = docs.get(name);
    if (entry?.code.slice(genOffset - 5, genOffset) === "this.") {
      const program = service.getProgram();
      const sourceFile = program?.getSourceFile(name);
      const checker = program?.getTypeChecker();
      let thisNode;
      let containingFunction;
      function visit(node) {
        if (
          ts.isFunctionExpression(node) &&
          node.getFullStart() < genOffset &&
          node.end >= genOffset
        ) {
          containingFunction = node;
        }
        if (
          node.kind === ts.SyntaxKind.ThisKeyword &&
          node.end === genOffset - 1
        ) {
          thisNode = node;
          return;
        }
        if (!thisNode && node.getFullStart() < genOffset && node.end >= genOffset - 1) {
          ts.forEachChild(node, visit);
        }
      }
      if (sourceFile && checker) visit(sourceFile);
      if (thisNode && checker) {
        const contextualSignature = containingFunction
          ? checker.getContextualType(containingFunction)?.getCallSignatures()[0]
          : undefined;
        const signature = contextualSignature ?? (containingFunction
          ? checker.getSignatureFromDeclaration(containingFunction)
          : undefined);
        const thisType = signature?.thisParameter
          ? checker.getTypeOfSymbolAtLocation(signature.thisParameter, containingFunction)
          : checker.getTypeAtLocation(thisNode);
        const properties = checker.getPropertiesOfType(thisType);
        if (properties.length) {
          return {
            isGlobalCompletion: false,
            isMemberCompletion: true,
            isNewIdentifierLocation: false,
            entries: properties.map((symbol) => {
              const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? thisNode;
              const callable = checker
                .getTypeOfSymbolAtLocation(symbol, declaration)
                .getCallSignatures().length > 0;
              return {
                name: symbol.getName(),
                kind: callable
                  ? ts.ScriptElementKind.memberFunctionElement
                  : ts.ScriptElementKind.memberVariableElement,
                kindModifiers: "",
                sortText: "11",
              };
            }),
          };
        }
      }
    }
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

  function tagDefinition(fileName, origOffset) {
    const name = tsName(fileName);
    const entry = docs.get(name);
    if (!entry || entry.error) return undefined;
    const tagPattern = /<(?:(?:[A-Za-z][\w-]*):)?([A-Za-z][\w-]*)>/g;
    let tagMatch;
    for (const match of entry.source.matchAll(tagPattern)) {
      const tagStart = match.index + match[0].lastIndexOf(match[1]);
      if (origOffset >= tagStart && origOffset <= tagStart + match[1].length) {
        tagMatch = match;
        break;
      }
    }
    if (!tagMatch) return undefined;

    const candidates = entry.maps.filter((map) => {
      if (tagMatch.index < map.origStart || tagMatch.index >= map.origEnd) return false;
      const generated = entry.code.slice(
        entry.preamble + map.genStart,
        entry.preamble + map.genStart + 16,
      );
      return /^;?__jsox_el\(/.test(generated);
    });
    const map = candidates.sort(
      (a, b) => (a.origEnd - a.origStart) - (b.origEnd - b.origStart),
    )[0];
    if (!map) return undefined;

    const sourceFile = service.getProgram()?.getSourceFile(name);
    if (!sourceFile) return undefined;
    const generatedStart = entry.preamble + map.genStart;
    let call;
    function visit(node) {
      if (call || generatedStart < node.getFullStart() || generatedStart >= node.end) return;
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "__jsox_el"
      ) {
        call = node;
        return;
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (!call) return undefined;

    const type = service.getProgram().getTypeChecker().getTypeAtLocation(call);
    const symbol = type.aliasSymbol ?? type.getSymbol();
    if (!symbol?.declarations?.length) return undefined;
    return symbol.declarations.map((declaration) => {
      const declarationName = declaration.name;
      const start = declarationName?.getStart() ?? declaration.getStart();
      const length = declarationName?.getWidth() ?? Math.max(1, declaration.getWidth());
      return {
        fileName: declaration.getSourceFile().fileName,
        textSpan: { start, length },
        kind: ts.ScriptElementKind.interfaceElement,
        name: symbol.getName(),
        containerKind: undefined,
        containerName: "",
      };
    });
  }

  function definitionToOriginal(def) {
    const physical = physicalJsoxName(def.fileName);
    if (!physical) return def;
    let entry = docs.get(def.fileName);
    if (!entry) {
      const source = ts.sys.readFile(physical);
      if (source == null) return def;
      entry = { source, ...toVirtual(source, config) };
    }
    const start = genOffsetToOrig(entry, def.textSpan.start);
    const end = genOffsetToOrig(entry, def.textSpan.start + def.textSpan.length);
    return {
      ...def,
      fileName: physical,
      textSpan: {
        start: Math.min(start, end),
        length: Math.abs(end - start),
      },
    };
  }

  function signatures(fileName, genOffset) {
    return service.getSignatureHelpItems(tsName(fileName), genOffset, {});
  }

  function semanticTokens(fileName) {
    const name = tsName(fileName);
    const entry = docs.get(name);
    if (!entry || entry.error) return [];
    const result = service.getEncodedSemanticClassifications(
      name,
      { start: 0, length: entry.code.length },
      ts.SemanticClassificationFormat.TwentyTwenty,
    );
    const tokens = [];
    for (let i = 0; i < result.spans.length; i += 3) {
      const genStart = result.spans[i];
      const genLength = result.spans[i + 1];
      const classification = result.spans[i + 2];
      if (genStart < entry.preamble) continue;
      if (entry.code.slice(genStart, genStart + genLength).startsWith("__jsox_")) continue;
      const start = genOffsetToOrig(entry, genStart);
      const end = genOffsetToOrig(entry, genStart + genLength);
      if (end <= start || end > entry.source.length) continue;
      if (
        entry.source.slice(start, end) !==
        entry.code.slice(genStart, genStart + genLength)
      ) {
        continue;
      }
      tokens.push({
        start,
        end,
        type: (classification >> 8) - 1,
        modifiers: classification & 0xff,
      });
    }
    const shorthand = /(?:^|\n)[\t ]*\.([A-Za-z_$][\w$]*)/g;
    for (const match of entry.source.matchAll(shorthand)) {
      const name = match[1];
      const start = match.index + match[0].lastIndexOf(name);
      const info = service.getQuickInfoAtPosition(tsName(fileName), origOffsetToGen(entry, start));
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (
          tokens[i].start < start + name.length &&
          tokens[i].end > start
        ) {
          tokens.splice(i, 1);
        }
      }
      tokens.push({
        start,
        end: start + name.length,
        type:
          info?.kind === ts.ScriptElementKind.memberFunctionElement
            ? 11
            : 9,
        modifiers: 0,
      });
    }
    const scopedTag = /<([A-Za-z][\w-]*):[A-Za-z][\w-]*>/g;
    for (const match of entry.source.matchAll(scopedTag)) {
      const start = match.index + 1;
      tokens.push({
        start,
        end: start + match[1].length,
        type: 3, // namespace
        modifiers: 0,
      });
    }
    tokens.sort((a, b) => a.start - b.start || a.end - b.end);
    return tokens.reduce((out, token) => {
      if (!out.length || token.start >= out[out.length - 1].end) out.push(token);
      return out;
    }, []);
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
    tagDefinition,
    definitionToOriginal,
    signatures,
    semanticTokens,
    diagnostics,
    tsName,
    config,
  };
}
