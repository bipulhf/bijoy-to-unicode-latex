import type {
  XmlNode,
  DocNode,
  RunNode,
  EquationNode,
  ImageNode,
  ParsedParagraph,
  ConversionWarning,
  ConvertOptions,
} from "../types.js";
import {
  getChild,
  getChildren,
  getTextContent,
  getAttrVal,
  hasChild,
  oFindChild,
  oGetChildByRef,
  oGetChildSequence,
  type ChildRef,
  type OrderedEntry,
} from "../reader/XmlParser.js";
import {
  isBijoyFont,
  hasBijoyMarkers,
  hasUnicodeBangla,
} from "../bijoy/BijoyDetector.js";
import { convertBijoyToUnicode } from "../bijoy/BijoyConverter.js";
import { fixBijoyRunBoundaries } from "../bijoy/runs.js";
import { joinLatex, ommlToLatex } from "../equations/OmmlDirectWalker.js";
import { wrapLatex } from "../equations/LatexWrapper.js";
import { extractOmmlNodes } from "../equations/OmmlExtractor.js";
import { fontFromRPr, type StyleResolver } from "../reader/StyleResolver.js";
import type { NumberingResolver } from "../reader/NumberingResolver.js";

export interface ParserContext {
  warnings: ConversionWarning[];
  paragraphIndex: number;
  options: ConvertOptions;
  stats: {
    bijoyRunsConverted: number;
    totalEquations: number;
    imagesSkipped: number;
  };
  /** Document-order view of the element being parsed (from the ordered parser). */
  orderedEntries?: OrderedEntry[];
  styles?: StyleResolver;
  numbering?: NumberingResolver;
}

// Elements that only wrap runs; their content is read as if it sat in the paragraph.
const INLINE_CONTAINERS = new Set([
  "w:hyperlink",
  "w:smartTag",
  "w:fldSimple",
  "w:customXml",
  "w:ins",
  "w:moveTo",
  "w:dir",
  "w:bdo",
]);

export function parseParagraph(
  pNode: XmlNode,
  ctx: ParserContext,
): ParsedParagraph {
  const nodes: DocNode[] = [];

  const pPr = getChild(pNode, "w:pPr");
  const styleId = pPr ? (getAttrVal(pPr, "w:pStyle", "w:val") ?? null) : null;
  const numPr = pPr ? getChild(pPr, "w:numPr") : undefined;
  const rawNumId = numPr
    ? parseIntOrNull(getAttrVal(numPr, "w:numId", "w:val"))
    : null;
  // numId 0 means "numbering removed" in WordprocessingML.
  const numId = rawNumId === 0 ? null : rawNumId;
  const ilvl = numPr
    ? parseIntOrNull(getAttrVal(numPr, "w:ilvl", "w:val"))
    : null;
  const numFmt = ctx.numbering?.getNumFmt(numId, ilvl) ?? null;

  processInline(pNode, ctx.orderedEntries, nodes, ctx, styleId);

  fixBijoyRunBoundaries(nodes.map((n) => (n.type === "text" ? n : null)));
  if (ctx.options.preserveFormatting) applyFormatting(nodes);

  return {
    nodes: mergeAdjacentEquations(nodes, ctx.options),
    styleId,
    numId,
    ilvl,
    numFmt,
  };
}

/**
 * Raw equation LaTeX is concatenated with its neighbours, so a trailing
 * command must not run into the next letter: Word often splits "p×q" into an
 * equation "×" followed by a text run "q", and "\\timesq" is not LaTeX.
 * Neighbouring equations are merged; an equation followed by a letter gets
 * a separating space.
 */
function mergeAdjacentEquations(
  nodes: DocNode[],
  options: ConvertOptions,
): DocNode[] {
  if (options.forceDisplay || options.forceInline) return nodes;
  const merged: DocNode[] = [];
  for (const node of nodes) {
    const prev = merged[merged.length - 1];
    if (prev?.type === "equation" && node.type === "equation") {
      merged[merged.length - 1] = {
        ...prev,
        ommlXml: joinLatex([prev.ommlXml, node.ommlXml]),
      };
      continue;
    }
    if (prev?.type === "equation" && node.type === "text") {
      const joined = joinLatex([prev.ommlXml, node.text]);
      if (joined.length > prev.ommlXml.length + node.text.length) {
        merged[merged.length - 1] = { ...prev, ommlXml: prev.ommlXml + " " };
      }
    }
    merged.push(node);
  }
  return merged;
}

interface ChildEntry {
  tag: string;
  index: number;
  ordered: OrderedEntry[] | undefined;
}

/** Children of `node` in document order when an ordered view is available. */
function childEntries(
  node: XmlNode,
  ordered: OrderedEntry[] | undefined,
): ChildEntry[] {
  const refs: ChildRef[] = ordered
    ? oGetChildSequence(ordered)
    : groupedSequence(node);
  return refs.map(({ tag, index }) => ({
    tag,
    index,
    ordered: ordered ? oGetChildByRef(ordered, tag, index) : undefined,
  }));
}

function groupedSequence(node: XmlNode): ChildRef[] {
  const seq: ChildRef[] = [];
  for (const tag of Object.keys(node)) {
    if (tag.startsWith("@_") || tag === "#text") continue;
    const val = node[tag];
    const count = Array.isArray(val) ? val.length : 1;
    for (let i = 0; i < count; i++) seq.push({ tag, index: i });
  }
  return seq;
}

function processInline(
  node: XmlNode,
  ordered: OrderedEntry[] | undefined,
  nodes: DocNode[],
  ctx: ParserContext,
  styleId: string | null,
): void {
  for (const entry of childEntries(node, ordered)) {
    if (entry.tag === "w:pPr") continue;
    const child = getChildren(node, entry.tag)[entry.index];
    if (!child) continue;
    processTagChild(entry.tag, child, nodes, ctx, styleId, entry.ordered);
  }
}

function processTagChild(
  tag: string,
  child: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
  styleId: string | null,
  childOrdered?: OrderedEntry[],
): void {
  switch (tag) {
    case "w:r":
      processRun(child, childOrdered, nodes, ctx, styleId);
      return;
    case "m:oMath":
      processEquation(child, nodes, ctx, childOrdered);
      return;
    case "m:oMathPara":
      processOmathPara(child, nodes, ctx, childOrdered);
      return;
    case "w:drawing":
    case "w:pict":
      processImage("image", nodes, ctx);
      return;
    case "w:sdt": {
      const sdtContent = getChild(child, "w:sdtContent");
      if (sdtContent) {
        const contentOrdered = childOrdered
          ? oFindChild(childOrdered, "w:sdtContent")
          : undefined;
        processInline(sdtContent, contentOrdered, nodes, ctx, styleId);
      }
      return;
    }
  }
  if (INLINE_CONTAINERS.has(tag)) {
    processInline(child, childOrdered, nodes, ctx, styleId);
  }
}

function applyFormatting(nodes: DocNode[]): void {
  for (const node of nodes) {
    if (node.type !== "text" || node.text.trim().length === 0) continue;
    if (node.bold && node.italic) node.text = `**_${node.text}_**`;
    else if (node.bold) node.text = `**${node.text}**`;
    else if (node.italic) node.text = `_${node.text}_`;
  }
}

function processRun(
  runNode: XmlNode,
  runOrdered: OrderedEntry[] | undefined,
  nodes: DocNode[],
  ctx: ParserContext,
  styleId: string | null,
): void {
  const rPr = getChild(runNode, "w:rPr");

  if (isToggleOn(rPr, "w:vanish")) return;

  const ownFont = fontFromRPr(rPr);
  const fontName = ctx.styles
    ? ctx.styles.resolveRunFont(rPr, styleId)
    : (ownFont ?? null);
  const bold = isToggleOn(rPr, "w:b");
  const italic = isToggleOn(rPr, "w:i");

  const pushText = (source: string, convertible: boolean): void => {
    let text = source;
    const bijoy =
      convertible &&
      !ctx.options.skipBijoy &&
      !hasUnicodeBangla(text) &&
      (isBijoyFont(fontName) || (!ownFont && hasBijoyMarkers(text)));

    if (bijoy) {
      text = convertBijoyToUnicode(text);
      ctx.stats.bijoyRunsConverted++;
    }

    const node: RunNode = {
      type: "text",
      text,
      isBijoy: bijoy,
      ...(bijoy ? { rawText: source } : {}),
      fontName,
      bold,
      italic,
    };
    nodes.push(node);
  };

  for (const { tag, index } of childEntries(runNode, runOrdered)) {
    switch (tag) {
      case "w:t": {
        const tNode = getChildren(runNode, "w:t")[index];
        const text = tNode === undefined ? "" : getTextContent(tNode);
        if (text) pushText(text, true);
        break;
      }
      case "w:tab":
        pushText(" ", false);
        break;
      case "w:br":
      case "w:cr":
        pushText("\n", false);
        break;
      case "w:noBreakHyphen":
        pushText("-", false);
        break;
      case "w:drawing":
      case "w:pict":
        processImage("image", nodes, ctx);
        break;
      case "w:object":
        processImage("ole", nodes, ctx);
        break;
    }
  }
}

function processEquation(
  ommlNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
  orderedEntries?: OrderedEntry[],
): void {
  if (ctx.options.skipEquations) return;

  ctx.stats.totalEquations++;

  try {
    const latex = ommlToLatex(
      ommlNode,
      {
        warnings: ctx.warnings,
        paragraphIndex: ctx.paragraphIndex,
        maxDepth: ctx.options.maxRecursionDepth,
      },
      0,
      orderedEntries,
    );

    if (!latex || latex.trim().length === 0) return;

    const wrapped = wrapLatex(latex, false, ctx.options);
    if (wrapped) {
      const eqNode: EquationNode = {
        type: "equation",
        ommlXml: wrapped,
        isDisplay: false,
      };
      nodes.push(eqNode);
    }
  } catch {
    ctx.warnings.push({
      type: "equation_parse_error",
      message: "Failed to convert OMML equation",
      paragraphIndex: ctx.paragraphIndex,
    });
    const fallback: EquationNode = {
      type: "equation",
      ommlXml: "[equation]",
      isDisplay: false,
    };
    nodes.push(fallback);
  }
}

function processOmathPara(
  omathParaNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
  parentOrdered?: OrderedEntry[],
): void {
  if (ctx.options.skipEquations) return;

  const oMaths = extractOmmlNodes(omathParaNode);
  for (let mi = 0; mi < oMaths.length; mi++) {
    const oMath = oMaths[mi]!;
    ctx.stats.totalEquations++;

    const oMathOrdered = parentOrdered
      ? oGetChildByRef(parentOrdered, "m:oMath", mi)
      : undefined;

    try {
      const latex = ommlToLatex(
        oMath,
        {
        warnings: ctx.warnings,
        paragraphIndex: ctx.paragraphIndex,
        maxDepth: ctx.options.maxRecursionDepth,
      },
        0,
        oMathOrdered,
      );

      if (!latex || latex.trim().length === 0) continue;

      const wrapped = wrapLatex(latex, true, ctx.options);
      if (wrapped) {
        const eqNode: EquationNode = {
          type: "equation",
          ommlXml: wrapped,
          isDisplay: true,
        };
        nodes.push(eqNode);
      }
    } catch {
      ctx.warnings.push({
        type: "equation_parse_error",
        message: "Failed to convert display OMML equation",
        paragraphIndex: ctx.paragraphIndex,
      });
      const fallback: EquationNode = {
        type: "equation",
        ommlXml: "[equation]",
        isDisplay: true,
      };
      nodes.push(fallback);
    }
  }
}

function processImage(
  kind: "image" | "ole",
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  ctx.stats.imagesSkipped++;
  ctx.warnings.push(
    kind === "ole"
      ? {
          type: "ole_equation",
          message: "OLE object (e.g. MathType equation) encountered — skipped",
          paragraphIndex: ctx.paragraphIndex,
        }
      : {
          type: "image_skipped",
          message: "Image node encountered — skipped",
          paragraphIndex: ctx.paragraphIndex,
        },
  );
  const imageNode: ImageNode = {
    type: "image",
    relationshipId: null,
  };
  nodes.push(imageNode);
}

function isToggleOn(rPr: XmlNode | undefined, tag: string): boolean {
  if (!rPr || !hasChild(rPr, tag)) return false;
  const val = getAttrVal(rPr, tag, "w:val");
  return val !== "0" && val !== "false" && val !== "off";
}

function parseIntOrNull(val: string | undefined): number | null {
  if (val === undefined) return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}
