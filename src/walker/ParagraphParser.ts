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
  getAllChildTags,
  getAttr,
  type ChildRef,
} from "../reader/XmlParser.js";
import { isBijoyFont, hasBijoyMarkers } from "../bijoy/BijoyDetector.js";
import { convertBijoyToUnicode } from "../bijoy/BijoyConverter.js";
import { ommlToLatex } from "../equations/OmmlDirectWalker.js";
import { wrapLatex } from "../equations/LatexWrapper.js";
import { extractOmmlNodes } from "../equations/OmmlExtractor.js";

interface ParserContext {
  warnings: ConversionWarning[];
  paragraphIndex: number;
  options: ConvertOptions;
  stats: {
    bijoyRunsConverted: number;
    totalEquations: number;
    imagesSkipped: number;
  };
  childOrder?: ChildRef[];
}

export function parseParagraph(
  pNode: XmlNode,
  ctx: ParserContext,
): ParsedParagraph {
  const nodes: DocNode[] = [];

  const pPr = getChild(pNode, "w:pPr");
  const styleId = pPr ? getAttrVal(pPr, "w:pStyle", "w:val") ?? null : null;
  const numPr = pPr ? getChild(pPr, "w:numPr") : undefined;
  const numId = numPr
    ? parseIntOrNull(getAttrVal(numPr, "w:numId", "w:val"))
    : null;
  const ilvl = numPr
    ? parseIntOrNull(getAttrVal(numPr, "w:ilvl", "w:val"))
    : null;

  if (ctx.childOrder) {
    processInOrder(pNode, ctx.childOrder, nodes, ctx);
  } else {
    processGrouped(pNode, nodes, ctx);
  }

  return { nodes, styleId, numId, ilvl };
}

function processInOrder(
  pNode: XmlNode,
  childOrder: ChildRef[],
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  for (const { tag, index } of childOrder) {
    if (tag === "w:pPr") continue;

    const children = getChildren(pNode, tag);
    const child = children[index];
    if (!child) continue;

    processTagChild(tag, child, pNode, nodes, ctx);
  }
}

function processGrouped(
  pNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  const childTags = getAllChildTags(pNode);
  for (const tag of childTags) {
    if (tag === "w:pPr") continue;
    const children = getChildren(pNode, tag);
    for (const child of children) {
      processTagChild(tag, child, pNode, nodes, ctx);
    }
  }
}

function processTagChild(
  tag: string,
  child: XmlNode,
  pNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  switch (tag) {
    case "w:r":
      processRun(child, nodes, ctx);
      break;
    case "m:oMath":
      processEquation(child, pNode, nodes, ctx);
      break;
    case "m:oMathPara":
      processOmathPara(child, nodes, ctx);
      break;
    case "w:ins":
      processInsert(child, nodes, ctx);
      break;
    case "w:del":
      break;
    case "w:drawing":
    case "w:pict":
      processImage(child, nodes, ctx);
      break;
    case "w:sdt": {
      const sdtContent = getChild(child, "w:sdtContent");
      if (sdtContent) {
        const innerPara = parseParagraph(sdtContent, ctx);
        nodes.push(...innerPara.nodes);
      }
      break;
    }
  }
}

function processRun(
  runNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  const rPr = getChild(runNode, "w:rPr");

  if (rPr && hasChild(rPr, "w:vanish")) return;

  const fontName = resolveFontName(rPr);
  const bold = rPr ? hasChild(rPr, "w:b") : false;
  const italic = rPr ? hasChild(rPr, "w:i") : false;

  const drawings = getChildren(runNode, "w:drawing");
  for (const drawing of drawings) {
    processImage(drawing, nodes, ctx);
  }
  const picts = getChildren(runNode, "w:pict");
  for (const pict of picts) {
    processImage(pict, nodes, ctx);
  }

  const tNodes = getChildren(runNode, "w:t");
  for (const tNode of tNodes) {
    let text = getTextContent(tNode);
    if (!text) continue;

    const bijoy = !ctx.options.skipBijoy && (isBijoyFont(fontName) || (!fontName && hasBijoyMarkers(text)));

    if (bijoy) {
      text = convertBijoyToUnicode(text);
      ctx.stats.bijoyRunsConverted++;
    }

    if (ctx.options.preserveFormatting) {
      if (bold && italic) text = `**_${text}_**`;
      else if (bold) text = `**${text}**`;
      else if (italic) text = `_${text}_`;
    }

    const node: RunNode = {
      type: "text",
      text,
      isBijoy: bijoy,
      fontName,
      bold,
      italic,
    };
    nodes.push(node);
  }
}

function processEquation(
  ommlNode: XmlNode,
  _parentPNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  if (ctx.options.skipEquations) return;

  ctx.stats.totalEquations++;

  try {
    const latex = ommlToLatex(ommlNode, {
      warnings: ctx.warnings,
      paragraphIndex: ctx.paragraphIndex,
    });

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
): void {
  if (ctx.options.skipEquations) return;

  const oMaths = extractOmmlNodes(omathParaNode);
  for (const oMath of oMaths) {
    ctx.stats.totalEquations++;

    try {
      const latex = ommlToLatex(oMath, {
        warnings: ctx.warnings,
        paragraphIndex: ctx.paragraphIndex,
      });

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

function processInsert(
  insNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  const runs = getChildren(insNode, "w:r");
  for (const run of runs) {
    processRun(run, nodes, ctx);
  }
}

function processImage(
  _imgNode: XmlNode,
  nodes: DocNode[],
  ctx: ParserContext,
): void {
  ctx.stats.imagesSkipped++;
  ctx.warnings.push({
    type: "image_skipped",
    message: "Image node encountered — skipped",
    paragraphIndex: ctx.paragraphIndex,
  });
  const imageNode: ImageNode = {
    type: "image",
    relationshipId: null,
  };
  nodes.push(imageNode);
}

function resolveFontName(rPr: XmlNode | undefined): string | null {
  if (!rPr) return null;
  const rFonts = getChild(rPr, "w:rFonts");
  if (!rFonts) return null;
  return (
    (getAttr(rFonts, "w:ascii") as string | undefined) ??
    (getAttr(rFonts, "w:hAnsi") as string | undefined) ??
    (getAttr(rFonts, "w:cs") as string | undefined) ??
    null
  );
}

function parseIntOrNull(val: string | undefined): number | null {
  if (val === undefined) return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
}
