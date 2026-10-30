// One-time converter used to port the Roblox item/site data files to JS.
// Handles the Lua subset those files use; arithmetic goes through runtime
// helpers ($add/$mul/...) because vectors and frames have no operators in JS.
import luaparse from "luaparse";
import { readFileSync, writeFileSync } from "fs";

const [, , inFile, outFile] = process.argv;
let src = readFileSync(inFile, "utf8");
src = src.replace(/^(\s*)([A-Za-z_][\w\.\[\]"'#:]*?)\s*(\+|-|\*|\/|\.\.)=\s*(.+)$/gm, (m, ind, lv, op, rhs) => `${ind}${lv} = ${lv} ${op} (${rhs})`);
const ast = luaparse.parse(src, { luaVersion: "5.3", comments: false });

const BIN = { "==": "===", "~=": "!==", "and": "&&", "or": "||", "<": "<", ">": ">", "<=": "<=", ">=": ">=" };
const ARITH = { "+": "$add", "-": "$sub", "*": "$mul", "/": "$div", "%": "$mod", "^": "Math.pow", "..": "$cat" };
const RENAME_FIELD = { X: "x", Y: "y", Z: "z", Position: "pos", Magnitude: "len", CastShadow: "$castShadow", Reflectance: "refl", Name: "name" };

const METHOD = { Inverse: "inverse", PointToWorldSpace: "point", PointToObjectSpace: "pointToObj", VectorToWorldSpace: "vecToWorld", VectorToObjectSpace: "vecToObj", Lerp: "lerp", Dot: "dot", Cross: "cross" };
const NUM_PARAMS = new Set(["L", "H", "W", "w", "h", "bay", "bx", "bz", "len", "dia", "width", "length", "run", "sx", "sz", "i", "n", "m", "ang", "angle", "depth", "height", "radius", "lengthM", "kg"]);
const scopes = [new Map()];
const setType = (name, t) => scopes[scopes.length - 1].set(name, t);
function typeOf(name) {
  for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
  return undefined;
}
function isNum(n) {
  switch (n.type) {
    case "NumericLiteral": return true;
    case "UnaryExpression": return n.operator === "#" || (n.operator === "-" && isNum(n.argument));
    case "BinaryExpression": return ARITH[n.operator] && n.operator !== ".." && isNum(n.left) && isNum(n.right);
    case "LogicalExpression": return n.operator !== "and" || isNum(n.right) ? (n.operator === "or" ? isNum(n.left) && isNum(n.right) : isNum(n.right)) : false;
    case "Identifier": return typeOf(n.name) === "num";
    case "MemberExpression": {
      const nm = n.identifier.name;
      if (["X", "Y", "Z", "Magnitude", "pi", "huge", "d", "bf", "tf", "tw", "kgm", "lengthM", "basePlateM", "weightKg", "spanLength"].includes(nm)) return true;
      if (n.base.type === "Identifier" && (n.base.name === "G" || n.base.name === "math") && nm !== "ScaffoldBays") return true;
      return false;
    }
    case "CallExpression": {
      const b = n.base;
      return b.type === "MemberExpression" && b.base.type === "Identifier" && b.base.name === "math";
    }
    default: return false;
  }
}
let ind = 0;
const pad = () => "  ".repeat(ind);

function ex(n) {
  switch (n.type) {
    case "NumericLiteral": return n.raw;
    case "StringLiteral": return JSON.stringify(n.value !== null ? n.value : JSON.parse(n.raw.replace(/^'|'$/g, '"')));
    case "BooleanLiteral": return String(n.value);
    case "NilLiteral": return "undefined";
    case "VarargLiteral": return "...$va";
    case "Identifier": return id(n.name);
    case "BinaryExpression":
    case "LogicalExpression": {
      if (ARITH[n.operator]) {
        if (n.operator === "..") return `${catArg(n.left)} + ${catArg(n.right)}`;
        if (n.operator !== "^" && isNum(n.left) && isNum(n.right)) return `${par(n.left, n.operator, true)} ${n.operator} ${par(n.right, n.operator)}`;
        return `${ARITH[n.operator]}(${ex(n.left)}, ${ex(n.right)})`;
      }
      return `(${ex(n.left)} ${BIN[n.operator]} ${ex(n.right)})`;
    }
    case "UnaryExpression":
      if (n.operator === "-") return isNum(n.argument) ? `-${par(n.argument, "u")}` : `$unm(${ex(n.argument)})`;
      if (n.operator === "not") return `!(${ex(n.argument)})`;
      if (n.operator === "#") return `(${ex(n.argument)}).length`;
      throw new Error("unary " + n.operator);
    case "MemberExpression": {
      const name = n.identifier.name;
      if (n.indexer === ":") return `${ex(n.base)}.${METHOD[name] || name}`;
      const base = ex(n.base);
      if (base === "Math" || base === "string" || base === "table") return name === "pi" ? "Math.PI" : name === "huge" ? "Infinity" : `${base}.${name}`;
      if (base === "M" || base === "Enum.Material") return JSON.stringify(name);
      if (name === "Unit") return `${base}.unit()`;
      return `${base}.${RENAME_FIELD[name] || name}`;
    }
    case "IndexExpression": {
      if (n.index.type === "NumericLiteral") return `${ex(n.base)}[${Number(n.index.value) - 1}]`;
      if (isNum(n.index)) return `${ex(n.base)}[${par(n.index, "-")} - 1]`;
      return `${ex(n.base)}[${ex(n.index)}]`;
    }
    case "CallExpression": return call(n.base, n.arguments);
    case "StringCallExpression": return call(n.base, [n.argument]);
    case "TableCallExpression": return call(n.base, [n.arguments]);
    case "TableConstructorExpression": return table(n);
    case "FunctionDeclaration": return func(n, true);
    default: throw new Error("expr " + n.type);
  }
}

const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
// parenthesise a numeric operand where JS precedence needs it
function par(n, parentOp, isLeft) {
  const e = ex(n);
  if (n.type === "BinaryExpression" && ARITH[n.operator] && n.operator !== ".." && isNum(n)) {
    if (parentOp === "u") return `(${e})`;
    if (parentOp && PREC[n.operator] < PREC[parentOp]) return `(${e})`;
    if (parentOp && !isLeft && PREC[n.operator] === PREC[parentOp] && (parentOp === "-" || parentOp === "/" || parentOp === "%")) return `(${e})`;
  }
  if (parentOp && n.type === "LogicalExpression") return `(${e})`;
  return e;
}
function catArg(n) {
  if (n.type === "StringLiteral") return ex(n);
  if (n.type === "BinaryExpression" && n.operator === "..") return ex(n);
  if (n.type === "CallExpression" || n.type === "StringCallExpression") return ex(n);
  if (n.type === "MemberExpression" || n.type === "Identifier" || n.type === "IndexExpression") return ex(n);
  return `(${ex(n)})`;
}
function id(name) {
  const map = { math: "Math", V: "v", S: "1" };
  return map[name] || name;
}

function call(base, args) {
  const a = args.map(ex);
  const b = base.type === "MemberExpression" || base.type === "Identifier" ? ex(base) : ex(base);
  // well-known calls
  if (b === "CF") return a.length === 0 ? "new CF()" : `CF.at(${a.join(", ")})`;
  if (b === "CFrame.new") return a.length === 0 ? "new CF()" : `CF.at(${a.join(", ")})`;
  if (b === "CFrame.Angles") return `CF.angles(${a.join(", ")})`;
  if (b === "Vector3.new") return `v(${a.join(", ")})`;
  if (b === "Color3.fromRGB") return `rgb(${a.join(", ")})`;
  if (b === "Math.rad") return `rad(${a.join(", ")})`;
  if (b === "Math.huge") return "Infinity";
  if (b === "Math.atan2" || (b === "Math.atan" && a.length === 2)) return `Math.atan2(${a.join(", ")})`;
  if (b === "string.lower") return `(${a[0]}).toLowerCase()`;
  if (b === "string.find") return `((${a[0]}).indexOf(${a[1]}) >= 0)`;
  if (b === "Color3.new") return `rgb(Math.round(255 * ${a[0]}), Math.round(255 * ${a[1]}), Math.round(255 * ${a[2]}))`;
  if (b === "Factory.lookAlong" || b === "CFrame.lookAt") return `CF.${b === "CFrame.lookAt" ? "lookAt" : "lookAlong"}(${a.join(", ")})`;
  if (b === "Math.clamp") return `clamp(${a.join(", ")})`;
  if (b === "string.format") return `$fmt(${a.join(", ")})`;
  if (b === "tostring") return `String(${a.join(", ")})`;
  if (b === "table.insert") return a.length === 2 ? `${a[0]}.push(${a[1]})` : `${a[0]}.splice(${a[1]} - 1, 0, ${a[2]})`;
  if (b === "table.concat") return `${a[0]}.join(${a[1] || '""'})`;
  if (b === "table.unpack") return `...${a[0]}`;
  if (b.endsWith(".gsub")) return `$gsub(${b.slice(0, -5)}, ${a.join(", ")})`;
  if (b.endsWith(".SetAttribute")) return `(${b.slice(0, -13)}[${a[0]}] = ${a[1]})`;
  if (b === "require") return `/*require*/ ${a[0]}`;
  if (b === "assert") return `$assert(${a.join(", ")})`;
  return `${b}(${a.join(", ")})`;
}

function table(n) {
  if (n.fields.length === 0) return "[]";
  const keyed = n.fields.some((f) => f.type !== "TableValue");
  ind++;
  const parts = n.fields.map((f) => {
    if (f.type === "TableValue") {
      if (keyed) throw new Error("mixed table");
      return ex(f.value);
    }
    if (f.type === "TableKeyString") return `${f.key.name}: ${ex(f.value)}`;
    return `[${ex(f.key)}]: ${ex(f.value)}`;
  });
  ind--;
  const flat = keyed ? `{ ${parts.join(", ")} }` : `[${parts.join(", ")}]`;
  if (flat.length + ind * 2 <= 110 && !flat.includes("\n")) return flat;
  const inner = parts.map((x) => `${"  ".repeat(ind + 1)}${x},`).join("\n");
  return keyed ? `{\n${inner}\n${pad()}}` : `[\n${inner}\n${pad()}]`;
}

function func(n, asExpr) {
  const params = n.parameters.map((p) => (p.type === "VarargLiteral" ? "...$va" : id(p.name)));
  scopes.push(new Map());
  for (const p of n.parameters) if (p.type === "Identifier") setType(p.name, NUM_PARAMS.has(p.name) ? "num" : "obj");
  ind++;
  const body = n.body.map(st).join("\n");
  ind--;
  scopes.pop();
  if (asExpr) return `(${params.join(", ")}) => {\n${body}\n${pad()}}`;
  return { params, body };
}

function st(n) {
  switch (n.type) {
    case "LocalStatement": {
      n.variables.forEach((vv, i) => {
        const init = n.init[i];
        const objInit = init && (init.type === "TableConstructorExpression" || init.type === "StringLiteral" || init.type === "FunctionDeclaration" || (init.type === "CallExpression" && !isNum(init)));
        setType(vv.name, (init && isNum(init)) || (NUM_PARAMS.has(vv.name) && init && !objInit) ? "num" : "obj");
      });
      if (n.variables.length === 1) {
        const init = n.init.length ? ` = ${ex(n.init[0])}` : "";
        return `${pad()}let ${id(n.variables[0].name)}${init};`;
      }
      if (n.init.length === 1 && n.init[0].type === "CallExpression" && n.init[0].base.type === "MemberExpression" && n.init[0].base.identifier.name === "unpack") {
        return `${pad()}let [${n.variables.map((v) => id(v.name)).join(", ")}] = ${ex(n.init[0].arguments[0])};`;
      }
      return `${pad()}let [${n.variables.map((v) => id(v.name)).join(", ")}] = [${n.init.map(ex).join(", ")}];`;
    }
    case "AssignmentStatement": {
      if (n.variables.length === 1) return `${pad()}${lhs(n.variables[0])} = ${ex(n.init[0])};`;
      return `${pad()}[${n.variables.map(lhs).join(", ")}] = [${n.init.map(ex).join(", ")}];`;
    }
    case "CallStatement": return `${pad()}${ex(n.expression)};`;
    case "ReturnStatement": return `${pad()}return${n.arguments.length ? " " + n.arguments.map(ex).join(", ") : ""};`;
    case "LocalFunctionStatement":
    case "FunctionDeclaration": {
      const name = n.identifier ? ex(n.identifier) : "anon";
      const { params, body } = func(n, false);
      const decl = n.isLocal || n.type === "LocalFunctionStatement" ? "function " : "";
      if (decl) return `${pad()}function ${name}(${params.join(", ")}) {\n${body}\n${pad()}}`;
      return `${pad()}${name} = function (${params.join(", ")}) {\n${body}\n${pad()}};`;
    }
    case "IfStatement": {
      let out = "";
      n.clauses.forEach((c, i) => {
        if (c.type === "IfClause") out += `${pad()}if (${ex(c.condition)}) {\n`;
        else if (c.type === "ElseifClause") out += `${pad()}} else if (${ex(c.condition)}) {\n`;
        else out += `${pad()}} else {\n`;
        ind++;
        out += c.body.map(st).join("\n") + "\n";
        ind--;
      });
      return out + `${pad()}}`;
    }
    case "ForNumericStatement": {
      scopes.push(new Map());
      setType(n.variable.name, "num");
      const v = id(n.variable.name);
      const step = n.step ? ex(n.step) : "1";
      const neg = step.startsWith("$unm(") || step.startsWith("-");
      let out = `${pad()}for (let ${v} = ${ex(n.start)}; ${v} ${neg ? ">=" : "<="} ${ex(n.end)}; ${v} += ${step}) {\n`;
      ind++;
      out += n.body.map(st).join("\n") + "\n";
      ind--;
      scopes.pop();
      return out + `${pad()}}`;
    }
    case "ForGenericStatement": {
      const it = n.iterators[0];
      const vars = n.variables.map((v) => id(v.name));
      scopes.push(new Map());
      if (it.type === "CallExpression" && it.base.name === "ipairs") {
        const arr = it.arguments[0];
        setType(n.variables[0].name, "num");
        const numList = arr.type === "TableConstructorExpression" ? arr.fields.every((f) => isNum(f.value)) : arr.type === "MemberExpression" && ["Bays", "FloorHeights", "ScaffoldBays"].includes(arr.identifier.name);
        if (n.variables[1]) setType(n.variables[1].name, numList ? "num" : "obj");
      }
      let head;
      if (it.type === "CallExpression" && it.base.name === "ipairs") {
        const arr = ex(it.arguments[0]);
        head = vars[0] === "_" ? `for (const ${vars[1]} of ${arr}) {` : `for (const [$i_${vars[0]}, ${vars[1]}] of (${arr}).entries()) { const ${vars[0]} = $i_${vars[0]} + 1;`;
      } else if (it.type === "CallExpression" && it.base.name === "pairs") {
        head = `for (const [${vars[0]}, ${vars[1] || "_v"}] of Object.entries(${ex(it.arguments[0])})) {`;
      } else {
        head = `for (const [${vars.join(", ")}] of $iter(${ex(it)})) {`;
      }
      let out = `${pad()}${head}\n`;
      ind++;
      out += n.body.map(st).join("\n") + "\n";
      ind--;
      scopes.pop();
      return out + `${pad()}}`;
    }
    case "WhileStatement": {
      let out = `${pad()}while (${ex(n.condition)}) {\n`;
      ind++;
      out += n.body.map(st).join("\n") + "\n";
      ind--;
      return out + `${pad()}}`;
    }
    case "DoStatement": {
      let out = `${pad()}{\n`;
      ind++;
      out += n.body.map(st).join("\n") + "\n";
      ind--;
      return out + `${pad()}}`;
    }
    case "BreakStatement": return `${pad()}break;`;
    default: throw new Error("stmt " + n.type);
  }
}

function lhs(n) {
  return ex(n);
}

const body = ast.body.map(st).join("\n");
writeFileSync(outFile, `// AUTO-PORTED from ${inFile.split("/").pop()} — then edited by hand.\n${body}\n`);
console.log("wrote", outFile);
