import type { XmlNode, ConversionWarning } from "../types.js";
import {
  getChild,
  getChildren,
  getTextContent,
  getAttr,
  getAllChildTags,
  oGetChildSequence,
  oGetChildByRef,
  type OrderedEntry,
} from "../reader/XmlParser.js";
import { getOmmlPropVal, isOmmlPropOn } from "./OmmlExtractor.js";
import {
  NARY_MAP,
  ACCENT_MAP,
  GROUP_CHR_MAP,
  DELIMITER_MAP,
} from "./AccentMap.js";
import { OPERATOR_MAP } from "./OperatorMap.js";
import { GREEK_MAP } from "./GreekMap.js";
import { ARROW_MAP } from "./ArrowMap.js";
import { BLACKBOARD_MAP } from "./FontStyleMap.js";

const MAX_RECURSION_DEPTH = 50;

interface WalkerContext {
  warnings: ConversionWarning[];
  paragraphIndex: number;
  maxDepth?: number;
}

export function ommlToLatex(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number = 0,
  ordered?: OrderedEntry[],
): string {
  if (depth > (ctx.maxDepth ?? MAX_RECURSION_DEPTH)) {
    ctx.warnings.push({
      type: "recursion_limit",
      message: `OMML recursion depth exceeded at depth ${depth}`,
      paragraphIndex: ctx.paragraphIndex,
    });
    return "\\ldots";
  }

  const parts: string[] = [];

  if (ordered) {
    const seq = oGetChildSequence(ordered);
    for (const { tag, index } of seq) {
      const children = getChildren(node, tag);
      const child = children[index];
      if (!child) continue;
      const childOrdered = oGetChildByRef(ordered, tag, index);
      const result = processOmmlTag(tag, child, ctx, depth, childOrdered);
      if (result) parts.push(result);
    }
  } else {
    const tags = getAllChildTags(node);
    for (const tag of tags) {
      const children = getChildren(node, tag);
      for (const child of children) {
        const result = processOmmlTag(tag, child, ctx, depth);
        if (result) parts.push(result);
      }
    }
  }

  const textContent = getTextContent(node);
  if (textContent) {
    parts.unshift(mapSymbol(textContent));
  }

  return joinLatex(parts);
}

/**
 * Concatenates LaTeX fragments, adding a space where a control word would
 * otherwise run into a following letter (\alpha + x must not become \alphax).
 */
export function joinLatex(parts: string[]): string {
  let out = "";
  for (const part of parts) {
    if (/\\[A-Za-z]+$/.test(out) && /^[A-Za-z]/.test(part)) out += " ";
    out += part;
  }
  return out;
}

function processOmmlTag(
  tag: string,
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  switch (tag) {
    case "m:f":
      return handleFrac(node, ctx, depth, ordered);
    case "m:nary":
      return handleNary(node, ctx, depth, ordered);
    case "m:rad":
      return handleRad(node, ctx, depth, ordered);
    case "m:acc":
      return handleAcc(node, ctx, depth, ordered);
    case "m:bar":
      return handleBar(node, ctx, depth, ordered);
    case "m:func":
      return handleFunc(node, ctx, depth, ordered);
    case "m:eqArr":
      return handleEqArr(node, ctx, depth, ordered);
    case "m:groupChr":
      return handleGroupChr(node, ctx, depth, ordered);
    case "m:limLow":
      return handleLimLow(node, ctx, depth, ordered);
    case "m:limUpp":
      return handleLimUpp(node, ctx, depth, ordered);
    case "m:sPre":
      return handleSPre(node, ctx, depth, ordered);
    case "m:sSub":
      return handleSSub(node, ctx, depth, ordered);
    case "m:sSup":
      return handleSSup(node, ctx, depth, ordered);
    case "m:sSubSup":
      return handleSSubSup(node, ctx, depth, ordered);
    case "m:m":
      return handleMatrix(node, ctx, depth, ordered);
    case "m:d":
      return handleDelimiter(node, ctx, depth, ordered);
    case "m:borderBox":
      return handleBorderBox(node, ctx, depth, ordered);
    case "m:phant":
      return handlePhantom(node, ctx, depth, ordered);
    case "m:box":
      return recurseChild(node, "m:e", ctx, depth, ordered);
    case "m:r":
      return handleRun(node);
    case "m:t":
      return mapSymbol(getTextContent(node));
    case "m:e":
      return ommlToLatex(node, ctx, depth + 1, ordered);
    case "m:oMath":
      return ommlToLatex(node, ctx, depth + 1, ordered);
    default:
      return "";
  }
}

function recurseChild(
  parentNode: XmlNode,
  childTag: string,
  ctx: WalkerContext,
  depth: number,
  parentOrdered?: OrderedEntry[],
  childIndex: number = 0,
): string {
  const children = getChildren(parentNode, childTag);
  const child = children[childIndex];
  if (!child) return "";
  const childOrdered = parentOrdered
    ? oGetChildByRef(parentOrdered, childTag, childIndex)
    : undefined;
  return ommlToLatex(child, ctx, depth + 1, childOrdered);
}

function handleFrac(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const fracType = getOmmlPropVal(node, "m:fPr", "m:type", "m:val");
  const numLatex = recurseChild(node, "m:num", ctx, depth, ordered);
  const denLatex = recurseChild(node, "m:den", ctx, depth, ordered);

  switch (fracType) {
    case "noBar":
      return `\\binom{${numLatex}}{${denLatex}}`;
    case "lin":
      return `${groupForLinear(numLatex)}/${groupForLinear(denLatex)}`;
    case "skw":
      return `{}^{${numLatex}}/{}_{${denLatex}}`;
    default:
      return `\\frac{${numLatex}}{${denLatex}}`;
  }
}

function handleNary(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const chr = getOmmlPropVal(node, "m:naryPr", "m:chr", "m:val") ?? "\u222B";
  const subHide = isOmmlPropOn(node, "m:naryPr", "m:subHide");
  const supHide = isOmmlPropOn(node, "m:naryPr", "m:supHide");

  const cmd = NARY_MAP[chr] ?? `\\int`;

  let result = cmd;
  if (!subHide) {
    const subLatex = recurseChild(node, "m:sub", ctx, depth, ordered);
    if (subLatex) result += `_{${subLatex}}`;
  }
  if (!supHide) {
    const supLatex = recurseChild(node, "m:sup", ctx, depth, ordered);
    if (supLatex) result += `^{${supLatex}}`;
  }
  const eLatex = recurseChild(node, "m:e", ctx, depth, ordered);
  if (eLatex) result += ` ${eLatex}`;
  return result;
}

function handleRad(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const degHide = isOmmlPropOn(node, "m:radPr", "m:degHide");
  const base = recurseChild(node, "m:e", ctx, depth, ordered);

  if (degHide) return `\\sqrt{${base}}`;
  const degLatex = recurseChild(node, "m:deg", ctx, depth, ordered);
  if (!degLatex) return `\\sqrt{${base}}`;
  return `\\sqrt[${degLatex}]{${base}}`;
}

function handleAcc(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const chr = getOmmlPropVal(node, "m:accPr", "m:chr", "m:val") ?? "\u0302";
  const base = recurseChild(node, "m:e", ctx, depth, ordered);
  const cmd = ACCENT_MAP[chr] ?? "\\hat";
  return `${cmd}{${base}}`;
}

function handleBar(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const pos = getOmmlPropVal(node, "m:barPr", "m:pos", "m:val") ?? "top";
  const base = recurseChild(node, "m:e", ctx, depth, ordered);
  return pos === "bot" ? `\\underline{${base}}` : `\\overline{${base}}`;
}

function handleFunc(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const nameLatex = recurseChild(node, "m:fName", ctx, depth, ordered);
  const argLatex = recurseChild(node, "m:e", ctx, depth, ordered);
  const funcCmd = toFunctionCommand(nameLatex.trim());
  return `${funcCmd}{${argLatex}}`;
}

/**
 * Maps a leading function name to its command, keeping any scripts:
 * "sin" → \sin, "log_{2}" → \log_{2}, "lim" → \lim.
 */
function toFunctionCommand(name: string): string {
  const match = /^([A-Za-z]+)(?![A-Za-z])(.*)$/s.exec(name);
  if (!match) return name;
  const cmd = OPERATOR_MAP[match[1]!];
  return cmd ? cmd + match[2]! : name;
}

function groupForLinear(latex: string): string {
  return /^(?:[A-Za-z0-9.]+|\\[A-Za-z]+|\{.*\})$/s.test(latex)
    ? latex
    : `(${latex})`;
}

function handleEqArr(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const rows = getChildren(node, "m:e");
  if (rows.length === 0) return "";
  // Word stores alignment points as "&" in the row text; keep them unescaped.
  const rowLatex = rows.map((_, i) =>
    recurseChild(node, "m:e", ctx, depth, ordered, i).replace(/\\&/g, "&"),
  );
  return `\\begin{aligned}${rowLatex.join(" \\\\")}\\end{aligned}`;
}

function handleGroupChr(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const chr =
    getOmmlPropVal(node, "m:groupChrPr", "m:chr", "m:val") ?? "\u23DF";
  const pos = getOmmlPropVal(node, "m:groupChrPr", "m:pos", "m:val") ?? "bot";
  const base = recurseChild(node, "m:e", ctx, depth, ordered);

  const mapping = GROUP_CHR_MAP[chr];
  if (mapping) {
    const cmd = pos === "top" ? mapping.top : mapping.bot;
    return `${cmd}{${base}}`;
  }
  return pos === "top" ? `\\overbrace{${base}}` : `\\underbrace{${base}}`;
}

function handleLimLow(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const base = toFunctionCommand(
    recurseChild(node, "m:e", ctx, depth, ordered).trim(),
  );
  const limLatex = recurseChild(node, "m:lim", ctx, depth, ordered);
  if (isOperatorLike(base)) {
    return `${base}_{${limLatex}}`;
  }
  return `\\underset{${limLatex}}{${base}}`;
}

function handleLimUpp(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const base = toFunctionCommand(
    recurseChild(node, "m:e", ctx, depth, ordered).trim(),
  );
  const limLatex = recurseChild(node, "m:lim", ctx, depth, ordered);
  if (isOperatorLike(base)) {
    return `${base}^{${limLatex}}`;
  }
  return `\\overset{${limLatex}}{${base}}`;
}

function handleSPre(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const base = recurseChild(node, "m:e", ctx, depth, ordered);
  const subLatex = recurseChild(node, "m:sub", ctx, depth, ordered);
  const supLatex = recurseChild(node, "m:sup", ctx, depth, ordered);
  let pre = "{}";
  if (subLatex) pre += `_{${subLatex}}`;
  if (supLatex) pre += `^{${supLatex}}`;
  return `${pre}${base}`;
}

function handleSSub(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const base = recurseChild(node, "m:e", ctx, depth, ordered);
  const subLatex = recurseChild(node, "m:sub", ctx, depth, ordered);
  return `${base}_{${subLatex}}`;
}

function handleSSup(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const base = recurseChild(node, "m:e", ctx, depth, ordered);
  const supLatex = recurseChild(node, "m:sup", ctx, depth, ordered);
  return `${base}^{${supLatex}}`;
}

function handleSSubSup(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const base = recurseChild(node, "m:e", ctx, depth, ordered);
  const subLatex = recurseChild(node, "m:sub", ctx, depth, ordered);
  const supLatex = recurseChild(node, "m:sup", ctx, depth, ordered);
  return `${base}_{${subLatex}}^{${supLatex}}`;
}

function handleMatrix(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const rows = getChildren(node, "m:mr");
  if (rows.length === 0) return "";

  const rowsLatex: string[] = [];
  let maxCols = 0;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]!;
    const rowOrdered = ordered
      ? oGetChildByRef(ordered, "m:mr", ri)
      : undefined;
    const cells = getChildren(row, "m:e");
    maxCols = Math.max(maxCols, cells.length);
    const cellsLatex = cells.map((_, ci) =>
      recurseChild(row, "m:e", ctx, depth, rowOrdered, ci),
    );
    rowsLatex.push(cellsLatex.join(" & "));
  }

  if (rows.length > 50 || maxCols > 50) {
    ctx.warnings.push({
      type: "recursion_limit",
      message: `Large matrix ${rows.length}x${maxCols} truncated`,
      paragraphIndex: ctx.paragraphIndex,
    });
  }

  return `\\begin{matrix}${rowsLatex.join(" \\\\")}\\end{matrix}`;
}

function handleDelimiter(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const begChr = getOmmlPropVal(node, "m:dPr", "m:begChr", "m:val") ?? "(";
  const endChr = getOmmlPropVal(node, "m:dPr", "m:endChr", "m:val") ?? ")";

  const elements = getChildren(node, "m:e");
  const innerParts = elements.map((_, i) =>
    recurseChild(node, "m:e", ctx, depth, ordered, i),
  );

  const leftDel = mapDelimiter(begChr, "left");
  const rightDel = mapDelimiter(endChr, "right");

  const hasMatrix = elements.length === 1 && containsMatrix(elements[0]!);

  if (hasMatrix) {
    const eOrdered = ordered ? oGetChildByRef(ordered, "m:e", 0) : undefined;
    const matrixContent = getMatrixContent(elements[0]!, ctx, depth, eOrdered);
    if (matrixContent) {
      const env = getMatrixEnv(begChr, endChr);
      if (!env) return `\\left${leftDel} ${matrixContent} \\right${rightDel}`;
      return matrixContent
        .replace("\\begin{matrix}", `\\begin{${env}}`)
        .replace("\\end{matrix}", `\\end{${env}}`);
    }
  }

  const sepChr = getOmmlPropVal(node, "m:dPr", "m:sepChr", "m:val") ?? "|";
  const inner = innerParts.join(
    sepChr === "|" ? " \\mid " : `${mapSymbol(sepChr)} `,
  );

  return `\\left${leftDel} ${inner} \\right${rightDel}`;
}

function handleBorderBox(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const inner = recurseChild(node, "m:e", ctx, depth, ordered);
  return `\\boxed{${inner}}`;
}

function handlePhantom(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string {
  const inner = recurseChild(node, "m:e", ctx, depth, ordered);
  return `\\phantom{${inner}}`;
}

function handleRun(node: XmlNode): string {
  const text = getOmmlRunText(node);
  return mapSymbol(text);
}

function mapSymbol(text: string): string {
  if (!text) return "";

  const bb = BLACKBOARD_MAP[text];
  if (bb) return bb;

  const pieces: string[] = [];
  for (const char of text) {
    pieces.push(
      OPERATOR_MAP[char] ??
        GREEK_MAP[char] ??
        ARROW_MAP[char] ??
        BLACKBOARD_MAP[char] ??
        LATEX_SPECIAL[char] ??
        char,
    );
  }
  return joinLatex(pieces);
}

// Characters with a meaning in LaTeX that must print literally.
const LATEX_SPECIAL: Record<string, string> = {
  "%": "\\%",
  "#": "\\#",
  "&": "\\&",
  $: "\\$",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "\\": "\\backslash",
};

function mapDelimiter(chr: string, side: "left" | "right"): string {
  if (!chr || chr === "") return ".";

  const mapped = DELIMITER_MAP[chr];
  if (mapped) return mapped;

  if (chr === "|") {
    return side === "left" ? "\\lvert" : "\\rvert";
  }
  if (chr === "\u2016") {
    return side === "left" ? "\\lVert" : "\\rVert";
  }

  return chr;
}

function isOperatorLike(latex: string): boolean {
  return /^\\(?:lim|sum|prod|int|iint|iiint|oint|max|min|sup|inf|bigcap|bigcup|bigwedge|bigvee)(?![A-Za-z])/.test(
    latex,
  );
}

// Property elements carry no content of their own.
const PROPERTY_TAGS = new Set(["m:ctrlPr", "m:argPr"]);

/** True when the delimiter element holds a matrix and nothing else. */
function containsMatrix(node: XmlNode): boolean {
  const tags = getAllChildTags(node).filter((t) => !PROPERTY_TAGS.has(t));
  return (
    tags.length === 1 &&
    tags[0] === "m:m" &&
    getChildren(node, "m:m").length === 1
  );
}

function getMatrixContent(
  node: XmlNode,
  ctx: WalkerContext,
  depth: number,
  ordered?: OrderedEntry[],
): string | null {
  const matrices = getChildren(node, "m:m");
  if (matrices.length > 0 && matrices[0]) {
    const mOrdered = ordered ? oGetChildByRef(ordered, "m:m", 0) : undefined;
    return handleMatrix(matrices[0], ctx, depth + 1, mOrdered);
  }
  for (const tag of getAllChildTags(node)) {
    const children = getChildren(node, tag);
    for (let i = 0; i < children.length; i++) {
      const childOrdered = ordered
        ? oGetChildByRef(ordered, tag, i)
        : undefined;
      const result = getMatrixContent(children[i]!, ctx, depth, childOrdered);
      if (result) return result;
    }
  }
  return null;
}

function getMatrixEnv(begChr: string, endChr: string): string | null {
  if (begChr === "(" && endChr === ")") return "pmatrix";
  if (begChr === "[" && endChr === "]") return "bmatrix";
  if (begChr === "{" && endChr === "}") return "Bmatrix";
  if (begChr === "|" && endChr === "|") return "vmatrix";
  if (begChr === "\u2016" && endChr === "\u2016") return "Vmatrix";
  if (begChr === "{" && endChr === "") return "cases";
  return null;
}

const SYMBOL_FONT_MAP: Record<string, string> = {
  F0AE: "\u2192", // → rightwards arrow
  F0AC: "\u2190", // ← leftwards arrow
  F0AD: "\u2191", // ↑ upwards arrow
  F0AF: "\u2193", // ↓ downwards arrow
  F0AB: "\u2194", // ↔ left right arrow
  F0DE: "\u21D2", // ⇒ rightwards double arrow
  F0DC: "\u21D0", // ⇐ leftwards double arrow
  F0DB: "\u21D4", // ⇔ left right double arrow
};

function getOmmlRunText(node: XmlNode): string {
  const tNodes = getChildren(node, "m:t");
  let text = tNodes.map((t) => getTextContent(t)).join("");

  const sym = getChild(node, "w:sym");
  if (sym) {
    const charCode = getAttr(sym, "w:char");
    if (charCode) {
      const unicode = SYMBOL_FONT_MAP[charCode.toUpperCase()];
      if (unicode) text += unicode;
    }
  }

  return text;
}
