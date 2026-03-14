import type { XmlNode, ConversionWarning } from "../types.js";
import { getAttr, getTextContent } from "../reader/XmlParser.js";
import { OPERATOR_MAP } from "./OperatorMap.js";
import { GREEK_MAP } from "./GreekMap.js";
import { ARROW_MAP } from "./ArrowMap.js";
import { BLACKBOARD_MAP, MATH_FONT_MAP, SPACE_MAP } from "./FontStyleMap.js";

const MAX_DEPTH = 50;

interface MathContext {
  warnings: ConversionWarning[];
  paragraphIndex: number;
}

export function mathmlToLatex(
  node: XmlNode,
  ctx: MathContext,
  depth: number = 0,
): string {
  if (depth > MAX_DEPTH) {
    ctx.warnings.push({
      type: "recursion_limit",
      message: `MathML recursion depth exceeded at ${depth}`,
      paragraphIndex: ctx.paragraphIndex,
    });
    return "\\ldots";
  }

  const tags = getAllChildTags(node);
  if (tags.length === 0) {
    return mapMathSymbol(getTextContent(node));
  }

  const parts: string[] = [];
  for (const tag of tags) {
    const children = getChildren(node, tag);
    for (const child of children) {
      parts.push(processMathmlTag(tag, child, ctx, depth));
    }
  }
  return parts.join("");
}

function processMathmlTag(
  tag: string,
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  switch (tag) {
    case "mi":
      return handleMi(node);
    case "mn":
      return handleMn(node);
    case "mo":
      return handleMo(node);
    case "mtext":
      return handleMtext(node);
    case "ms":
      return handleMs(node);
    case "mspace":
      return handleMspace(node);
    case "mglyph":
      return handleMglyph(node, ctx);
    case "mrow":
      return mathmlToLatex(node, ctx, depth + 1);
    case "mfrac":
      return handleMfrac(node, ctx, depth);
    case "msqrt":
      return handleMsqrt(node, ctx, depth);
    case "mroot":
      return handleMroot(node, ctx, depth);
    case "mstyle":
      return handleMstyle(node, ctx, depth);
    case "merror":
      return handleMerror(node, ctx, depth);
    case "mpadded":
      return mathmlToLatex(node, ctx, depth + 1);
    case "mphantom":
      return handleMphantom(node, ctx, depth);
    case "mfenced":
      return handleMfenced(node, ctx, depth);
    case "menclose":
      return handleMenclose(node, ctx, depth);
    case "msub":
      return handleMsub(node, ctx, depth);
    case "msup":
      return handleMsup(node, ctx, depth);
    case "msubsup":
      return handleMsubsup(node, ctx, depth);
    case "munder":
      return handleMunder(node, ctx, depth);
    case "mover":
      return handleMover(node, ctx, depth);
    case "munderover":
      return handleMunderover(node, ctx, depth);
    case "mmultiscripts":
      return handleMmultiscripts(node, ctx, depth);
    case "mtable":
      return handleMtable(node, ctx, depth);
    case "mtr":
      return handleMtr(node, ctx, depth);
    case "mlabeledtr":
      return handleMlabeledtr(node, ctx, depth);
    case "mtd":
      return mathmlToLatex(node, ctx, depth + 1);
    case "maligngroup":
    case "malignmark":
      return "&";
    case "math":
      return mathmlToLatex(node, ctx, depth + 1);
    default:
      return mathmlToLatex(node, ctx, depth + 1);
  }
}

function handleMi(node: XmlNode): string {
  const text = getTextContent(node);
  const variant = getAttr(node, "mathvariant");
  const mapped = mapMathSymbol(text);

  if (variant) {
    const wrapper = MATH_FONT_MAP[variant];
    if (wrapper) return wrapper(mapped);
  }

  return mapped;
}

function handleMn(node: XmlNode): string {
  return getTextContent(node);
}

function handleMo(node: XmlNode): string {
  const text = getTextContent(node);
  return mapMathSymbol(text);
}

function handleMtext(node: XmlNode): string {
  const text = getTextContent(node);
  if (!text.trim()) return "";
  return `\\text{${text}}`;
}

function handleMs(node: XmlNode): string {
  const text = getTextContent(node);
  return `\\text{"${text}"}`;
}

function handleMspace(node: XmlNode): string {
  const width = getAttr(node, "width");
  if (!width) return "\\;";
  const mapped = SPACE_MAP[width];
  if (mapped !== undefined) return mapped;
  if (width.endsWith("em")) {
    const val = parseFloat(width);
    if (val <= 0.15) return "\\,";
    if (val <= 0.25) return "\\:";
    if (val <= 0.5) return "\\;";
    if (val <= 1.5) return "\\quad";
    return "\\qquad";
  }
  return "\\;";
}

function handleMglyph(node: XmlNode, ctx: MathContext): string {
  const alt = getAttr(node, "alt");
  if (alt) return alt;
  ctx.warnings.push({
    type: "unsupported_equation",
    message: "mglyph without alt text",
    paragraphIndex: ctx.paragraphIndex,
  });
  return "";
}

function handleMfrac(node: XmlNode, ctx: MathContext, depth: number): string {
  const children = getOrderedChildren(node);
  const num = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const den = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  return `\\frac{${num}}{${den}}`;
}

function handleMsqrt(node: XmlNode, ctx: MathContext, depth: number): string {
  return `\\sqrt{${mathmlToLatex(node, ctx, depth + 1)}}`;
}

function handleMroot(node: XmlNode, ctx: MathContext, depth: number): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const index = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  return `\\sqrt[${index}]{${base}}`;
}

function handleMstyle(node: XmlNode, ctx: MathContext, depth: number): string {
  const variant = getAttr(node, "mathvariant");
  const displayStyle = getAttr(node, "displaystyle");
  const scriptLevel = getAttr(node, "scriptlevel");

  let inner = mathmlToLatex(node, ctx, depth + 1);

  if (variant) {
    const wrapper = MATH_FONT_MAP[variant];
    if (wrapper) inner = wrapper(inner);
  }

  if (displayStyle === "true") {
    inner = `\\displaystyle ${inner}`;
  }

  if (scriptLevel === "+1") {
    inner = `\\scriptstyle ${inner}`;
  } else if (scriptLevel === "+2") {
    inner = `\\scriptscriptstyle ${inner}`;
  }

  return inner;
}

function handleMerror(node: XmlNode, ctx: MathContext, depth: number): string {
  const inner = mathmlToLatex(node, ctx, depth + 1);
  return `\\text{[error: ${inner}]}`;
}

function handleMphantom(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  return `\\phantom{${mathmlToLatex(node, ctx, depth + 1)}}`;
}

function handleMfenced(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  const open = getAttr(node, "open") ?? "(";
  const close = getAttr(node, "close") ?? ")";
  const separators = getAttr(node, "separators") ?? ",";

  const children = getOrderedChildren(node);
  const parts = children.map((c) => mathmlToLatex(c, ctx, depth + 1));
  const sep = separators[0] ?? ",";
  const inner = parts.join(` ${sep} `);

  return `\\left${mapDelim(open)} ${inner} \\right${mapDelim(close)}`;
}

function handleMenclose(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  const notation = getAttr(node, "notation") ?? "longdiv";
  const inner = mathmlToLatex(node, ctx, depth + 1);

  const notations = notation.split(/\s+/);
  let result = inner;

  for (const n of notations) {
    switch (n) {
      case "longdiv":
      case "actuarial":
      case "top":
        result = `\\overline{${result}}`;
        break;
      case "radical":
        result = `\\sqrt{${result}}`;
        break;
      case "box":
      case "roundedbox":
      case "circle":
        result = `\\boxed{${result}}`;
        break;
      case "bottom":
        result = `\\underline{${result}}`;
        break;
      case "updiagonalstrike":
        result = `\\cancel{${result}}`;
        break;
      case "downdiagonalstrike":
        result = `\\bcancel{${result}}`;
        break;
      case "horizontalstrike":
        result = `\\xcancel{${result}}`;
        break;
      case "verticalstrike":
        result = `\\hcancel{${result}}`;
        break;
      case "madruwb":
        result = `\\overline{${result}}`;
        break;
      case "phasorangle":
        result = `\\angle ${result}`;
        break;
      case "updiagonalarrow":
        result = `\\nearrow ${result}`;
        break;
      case "left":
        result = `\\left\\vert ${result}`;
        break;
      case "right":
        result = `${result} \\right\\vert`;
        break;
    }
  }

  return result;
}

function handleMsub(node: XmlNode, ctx: MathContext, depth: number): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const sub = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  return `${base}_{${sub}}`;
}

function handleMsup(node: XmlNode, ctx: MathContext, depth: number): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const sup = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  return `${base}^{${sup}}`;
}

function handleMsubsup(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const sub = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  const sup = children[2] ? mathmlToLatex(children[2], ctx, depth + 1) : "";
  return `${base}_{${sub}}^{${sup}}`;
}

function handleMunder(node: XmlNode, ctx: MathContext, depth: number): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const under = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  if (isLargeOp(base)) {
    return `${base}_{${under}}`;
  }
  return `\\underset{${under}}{${base}}`;
}

function handleMover(node: XmlNode, ctx: MathContext, depth: number): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const over = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  if (isLargeOp(base)) {
    return `${base}^{${over}}`;
  }
  return `\\overset{${over}}{${base}}`;
}

function handleMunderover(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  const children = getOrderedChildren(node);
  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const under = children[1] ? mathmlToLatex(children[1], ctx, depth + 1) : "";
  const over = children[2] ? mathmlToLatex(children[2], ctx, depth + 1) : "";
  return `${base}_{${under}}^{${over}}`;
}

function handleMmultiscripts(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  const children = getOrderedChildren(node);
  if (children.length === 0) return "";

  const base = children[0] ? mathmlToLatex(children[0], ctx, depth + 1) : "";
  const postScripts: [string, string][] = [];
  const preScripts: [string, string][] = [];
  let inPre = false;

  for (let i = 1; i < children.length; i++) {
    const child = children[i]!;
    const childTags = getAllChildTags(child);

    if (childTags.includes("mprescripts") || getTextContent(child) === "") {
      const hasPrescripts = childTags.includes("mprescripts");
      if (hasPrescripts) {
        inPre = true;
        continue;
      }
    }

    const nextChild = children[i + 1];
    const sub = mathmlToLatex(child, ctx, depth + 1);
    const sup = nextChild ? mathmlToLatex(nextChild, ctx, depth + 1) : "";
    i++;

    if (inPre) {
      preScripts.push([sub, sup]);
    } else {
      postScripts.push([sub, sup]);
    }
  }

  const pre = preScripts
    .map(([s, p]) => `${s ? `_{${s}}` : ""}${p ? `^{${p}}` : ""}`)
    .join("");
  const post = postScripts
    .map(([s, p]) => `${s ? `_{${s}}` : ""}${p ? `^{${p}}` : ""}`)
    .join("");

  return `{}${pre}${base}${post}`;
}

function handleMtable(node: XmlNode, ctx: MathContext, depth: number): string {
  const columnAlign = getAttr(node, "columnalign");
  const rows = getChildren(node, "mtr");
  const labeledRows = getChildren(node, "mlabeledtr");
  const allRows = [...rows, ...labeledRows];

  if (allRows.length === 0) return "";

  const isAligned = columnAlign?.includes("left") ?? false;

  const rowsLatex = allRows.map((row) => {
    const cells = getChildren(row, "mtd");
    return cells.map((c) => mathmlToLatex(c, ctx, depth + 1)).join(" & ");
  });

  const env = isAligned ? "aligned" : "array";
  return `\\begin{${env}}\n${rowsLatex.join(" \\\\\n")}\n\\end{${env}}`;
}

function handleMtr(node: XmlNode, ctx: MathContext, depth: number): string {
  const cells = getChildren(node, "mtd");
  return cells.map((c) => mathmlToLatex(c, ctx, depth + 1)).join(" & ");
}

function handleMlabeledtr(
  node: XmlNode,
  ctx: MathContext,
  depth: number,
): string {
  const children = getOrderedChildren(node);
  // First child is the label — skip it
  const dataCells = children.slice(1);
  return dataCells.map((c) => mathmlToLatex(c, ctx, depth + 1)).join(" & ");
}

function mapMathSymbol(text: string): string {
  if (!text) return "";

  const bb = BLACKBOARD_MAP[text];
  if (bb) return bb;

  const op = OPERATOR_MAP[text];
  if (op) return op;

  const greek = GREEK_MAP[text];
  if (greek) return greek;

  const arrow = ARROW_MAP[text];
  if (arrow) return arrow;

  let result = "";
  for (const ch of text) {
    const chBb = BLACKBOARD_MAP[ch];
    if (chBb) { result += chBb; continue; }
    const chOp = OPERATOR_MAP[ch];
    if (chOp) { result += chOp; continue; }
    const chGreek = GREEK_MAP[ch];
    if (chGreek) { result += chGreek; continue; }
    const chArrow = ARROW_MAP[ch];
    if (chArrow) { result += chArrow; continue; }
    result += ch;
  }
  return result;
}

function mapDelim(ch: string): string {
  if (!ch || ch === "") return ".";
  if (ch === "{") return "\\{";
  if (ch === "}") return "\\}";
  if (ch === "|") return "|";
  if (ch === "\u2016") return "\\|";
  if (ch === "\u230A") return "\\lfloor";
  if (ch === "\u230B") return "\\rfloor";
  if (ch === "\u2308") return "\\lceil";
  if (ch === "\u2309") return "\\rceil";
  if (ch === "\u27E8") return "\\langle";
  if (ch === "\u27E9") return "\\rangle";
  return ch;
}

function isLargeOp(latex: string): boolean {
  return /^\\(?:sum|prod|coprod|int|iint|iiint|oint|lim|max|min|sup|inf|bigcap|bigcup|bigwedge|bigvee)/.test(
    latex,
  );
}

function getOrderedChildren(node: XmlNode): XmlNode[] {
  const result: XmlNode[] = [];
  for (const tag of getAllChildTags(node)) {
    const children = getChildren(node, tag);
    result.push(...children);
  }
  return result;
}

function getAllChildTags(node: XmlNode): string[] {
  return Object.keys(node).filter(
    (k) => !k.startsWith("@_") && k !== "#text",
  );
}

function getChildren(node: XmlNode, tagName: string): XmlNode[] {
  const val = node[tagName];
  if (val === undefined || val === null) return [];
  if (Array.isArray(val)) return val as XmlNode[];
  if (typeof val === "object") return [val as XmlNode];
  return [];
}
