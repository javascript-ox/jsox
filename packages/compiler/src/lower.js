import { parseSync } from "oxc-parser";
import { generate } from "astring";
import { EL, SCOPE } from "./splice.js";
import { childHelperSource, normalizeConfig } from "./config.js";

function ident(name) {
  return { type: "Identifier", name };
}

function thisExpr() {
  return { type: "ThisExpression" };
}

function literal(value) {
  return {
    type: "Literal",
    value,
    raw: typeof value === "string" ? JSON.stringify(value) : String(value),
  };
}

function isId(node, name) {
  return node && node.type === "Identifier" && node.name === name;
}

function isIRCall(node, name) {
  return (
    node &&
    node.type === "CallExpression" &&
    isId(node.callee, name)
  );
}

function addPattern(pat, set) {
  if (!pat) return;
  switch (pat.type) {
    case "Identifier":
      set.add(pat.name);
      break;
    case "ObjectPattern":
      for (const p of pat.properties) {
        if (p.type === "Property") addPattern(p.value, set);
        else if (p.type === "RestElement") addPattern(p.argument, set);
      }
      break;
    case "ArrayPattern":
      for (const el of pat.elements) addPattern(el, set);
      break;
    case "RestElement":
      addPattern(pat.argument, set);
      break;
    case "AssignmentPattern":
      addPattern(pat.left, set);
      break;
    default:
      break;
  }
}

function collectBindings(node, set) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectBindings(n, set);
    return;
  }
  if (!node.type) {
    for (const v of Object.values(node)) collectBindings(v, set);
    return;
  }
  switch (node.type) {
    case "VariableDeclarator":
      addPattern(node.id, set);
      collectBindings(node.init, set);
      return;
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      if (node.id) set.add(node.id.name);
      for (const p of node.params) addPattern(p, set);
      collectBindings(node.body, set);
      return;
    case "ClassDeclaration":
    case "ClassExpression":
      if (node.id) set.add(node.id.name);
      collectBindings(node.body, set);
      collectBindings(node.superClass, set);
      return;
    case "ImportSpecifier":
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
      addPattern(node.local, set);
      return;
    case "CatchClause":
      addPattern(node.param, set);
      collectBindings(node.body, set);
      return;
    case "Property":
      if (node.computed) collectBindings(node.key, set);
      collectBindings(node.value, set);
      return;
    default:
      break;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "loc" || k === "range" || k === "start" || k === "end" || k === "raw") {
      continue;
    }
    collectBindings(v, set);
  }
}

function unwrapParens(node) {
  while (node && node.type === "ParenthesizedExpression") node = node.expression;
  return node;
}

function parseExpr(snippet) {
  const r = parseSync("snippet.js", `(${snippet});`, { preserveParens: false });
  if (r.errors?.length) {
    const msg = r.errors.map((e) => e.message).join("; ");
    throw new SyntaxError(`config.create() produced invalid JS: ${msg}`);
  }
  const stmt = r.program.body[0];
  return unwrapParens(stmt.expression);
}

function walkSkipKeys(key) {
  return (
    key === "loc" ||
    key === "range" ||
    key === "start" ||
    key === "end" ||
    key === "raw" ||
    key === "comments"
  );
}

function mapNode(node, fn) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => fn(n));
  if (!node.type) return node;
  const out = { ...node };
  for (const [k, v] of Object.entries(node)) {
    if (walkSkipKeys(k)) continue;
    if (v && typeof v === "object") out[k] = fn(v);
  }
  return out;
}

function ensureReturnThis(fn) {
  const body = fn.body;
  if (!body || body.type !== "BlockStatement") return fn;
  const last = body.body[body.body.length - 1];
  if (
    last &&
    last.type === "ReturnStatement" &&
    last.argument &&
    last.argument.type === "ThisExpression"
  ) {
    return fn;
  }
  return {
    ...fn,
    body: {
      ...body,
      body: [
        ...body.body,
        { type: "ReturnStatement", argument: thisExpr() },
      ],
    },
  };
}

function callOn(fn, target) {
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      object: fn,
      property: ident("call"),
      computed: false,
      optional: false,
    },
    arguments: [target],
    optional: false,
  };
}

function childCall(args, config, state) {
  if (config.strict && config.childMethods.length === 1) {
    return {
      type: "CallExpression",
      callee: {
        type: "MemberExpression",
        object: thisExpr(),
        property: ident(config.childMethods[0]),
        computed: false,
        optional: false,
      },
      arguments: args,
      optional: false,
    };
  }
  state.usedChild = true;
  return {
    type: "CallExpression",
    callee: ident(state.childHelperName),
    arguments: [thisExpr(), ...args],
    optional: false,
  };
}

function chooseChildHelperName(config, bindings) {
  const base = config.childHelperName;
  if (!/^[$_\p{ID_Start}][$\u200C\u200D_\p{ID_Continue}]*$/u.test(base)) {
    throw new TypeError("config.childHelperName must be a valid JavaScript identifier");
  }
  const check = parseSync("config.js", `function ${base}() {}`, {
    sourceType: "module",
  });
  if (check.errors?.length) {
    throw new TypeError("config.childHelperName must be a valid JavaScript identifier");
  }
  let name = base;
  let suffix = 1;
  while (bindings.has(name)) name = `${base}_${suffix++}`;
  return name;
}

function transformFn(fn, ctx) {
  if (!fn || fn.type !== "FunctionExpression") return fn;
  const body = transform(fn.body, { ...ctx, inConstruct: true, statement: false });
  return ensureReturnThis({ ...fn, body });
}

function lowerEl(node, ctx) {
  const tagArg = node.arguments[0];
  const tag =
    tagArg && tagArg.type === "Literal" ? String(tagArg.value) : null;
  if (tag == null) {
    throw new SyntaxError(`${EL}() requires a string tag name`);
  }
  const created = parseExpr(ctx.config.create(tag));
  const fn = node.arguments[1];
  let expr;
  if (!fn) {
    expr = created;
  } else {
    expr = callOn(transformFn(fn, ctx), created);
  }
  if (ctx.inConstruct && ctx.statement) {
    return childCall([expr], ctx.config, ctx.state);
  }
  return expr;
}

function lowerScope(node, ctx) {
  const target = transform(node.arguments[0], {
    ...ctx,
    statement: false,
  });
  const fn = node.arguments[1];
  const expr = fn
    ? callOn(transformFn(fn, ctx), target)
    : target;
  if (ctx.inConstruct && ctx.statement) {
    return childCall([expr], ctx.config, ctx.state);
  }
  return expr;
}

const NESTED_FN = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ClassDeclaration",
  "ClassExpression",
]);

function transform(node, ctx) {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => transform(n, ctx));
  if (!node.type) return node;
  if (node.type === "ParenthesizedExpression") {
    return transform(unwrapParens(node), ctx);
  }

  if (isIRCall(node, EL)) return lowerEl(node, ctx);
  if (isIRCall(node, SCOPE)) return lowerScope(node, ctx);

  if (node.type === "ExpressionStatement") {
    const innerCtx = { ...ctx, statement: true };
    if (
      ctx.inConstruct &&
      node.expression &&
      node.expression.type === "ArrayExpression"
    ) {
      const elements = (node.expression.elements || []).flatMap((el) => {
        if (!el) return [];
        return [transform(el, { ...ctx, statement: false })];
      });
      return {
        ...node,
        expression: childCall(elements, ctx.config, ctx.state),
      };
    }
    return {
      ...node,
      expression: transform(node.expression, innerCtx),
    };
  }

  if (
    ctx.inConstruct &&
    node.type === "AssignmentExpression" &&
    node.operator === "=" &&
    node.left &&
    node.left.type === "Identifier" &&
    !ctx.bindings.has(node.left.name)
  ) {
    return {
      ...node,
      left: {
        type: "MemberExpression",
        object: thisExpr(),
        property: ident(node.left.name),
        computed: false,
        optional: false,
      },
      right: transform(node.right, { ...ctx, statement: false }),
    };
  }

  if (NESTED_FN.has(node.type) && ctx.inConstruct) {
    return mapNode(node, (child) =>
      transform(child, { ...ctx, inConstruct: false, statement: false })
    );
  }

  return mapNode(node, (child) =>
    transform(child, { ...ctx, statement: false })
  );
}

function assertNoIR(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) assertNoIR(child);
    return;
  }
  if (isIRCall(node, EL) || isIRCall(node, SCOPE)) {
    throw new Error(`IR leaked into output: found ${EL} or ${SCOPE}`);
  }
  for (const [key, child] of Object.entries(node)) {
    if (walkSkipKeys(key)) continue;
    assertNoIR(child);
  }
}

/**
 * Parse spliced IR and desugar to plain JS.
 */
export function lower(spliced, configInput) {
  const config = normalizeConfig(configInput);
  const parsed = parseSync("input.js", spliced, {
    lang: "js",
    sourceType: "unambiguous",
    preserveParens: false,
  });
  if (parsed.errors?.length) {
    const msg = parsed.errors
      .map((e) => e.message || JSON.stringify(e))
      .join("\n");
    const err = new SyntaxError(msg);
    err.errors = parsed.errors;
    throw err;
  }
  const bindings = new Set();
  collectBindings(parsed.program, bindings);
  const state = {
    usedChild: false,
    childHelperName: chooseChildHelperName(config, bindings),
  };
  const program = transform(parsed.program, {
    inConstruct: false,
    statement: false,
    bindings,
    config,
    state,
  });
  let code = generate(program);
  if (state.usedChild) {
    code = childHelperSource(config, state.childHelperName) + code;
  }
  assertNoIR(program);
  return { code, usedChild: state.usedChild };
}
