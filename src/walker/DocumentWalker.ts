import type {
  XmlNode,
  BodyElement,
  ConversionWarning,
  ConvertOptions,
  ConversionStats,
} from "../types.js";
import { getChild, getChildren, getAllChildTags } from "../reader/XmlParser.js";
import { parseParagraph } from "./ParagraphParser.js";
import { parseTable } from "./TableParser.js";

interface WalkerContext {
  warnings: ConversionWarning[];
  options: ConvertOptions;
  stats: {
    bijoyRunsConverted: number;
    totalEquations: number;
    imagesSkipped: number;
    tablesProcessed: number;
  };
}

export function walkDocument(
  documentXml: XmlNode,
  options: ConvertOptions,
): { elements: BodyElement[]; stats: Omit<ConversionStats, "totalQuestions"> } {
  const ctx: WalkerContext = {
    warnings: [],
    options,
    stats: {
      bijoyRunsConverted: 0,
      totalEquations: 0,
      imagesSkipped: 0,
      tablesProcessed: 0,
    },
  };

  const doc =
    getChild(documentXml, "w:document") ?? documentXml;
  const body = getChild(doc, "w:body") ?? doc;
  const elements = walkBody(body, ctx, 0);

  return {
    elements,
    stats: {
      ...ctx.stats,
      warnings: ctx.warnings,
    },
  };
}

function walkBody(
  bodyNode: XmlNode,
  ctx: WalkerContext,
  depth: number,
): BodyElement[] {
  const maxDepth = ctx.options.maxRecursionDepth ?? 50;
  if (depth > maxDepth) {
    ctx.warnings.push({
      type: "recursion_limit",
      message: `Document walker recursion depth exceeded at ${depth}`,
      paragraphIndex: -1,
    });
    return [];
  }

  const elements: BodyElement[] = [];
  let paragraphIndex = 0;

  const tags = getAllChildTags(bodyNode);

  for (const tag of tags) {
    const children = getChildren(bodyNode, tag);

    for (const child of children) {
      switch (tag) {
        case "w:p": {
          const para = parseParagraph(child, {
            warnings: ctx.warnings,
            paragraphIndex,
            options: ctx.options,
            stats: ctx.stats,
          });
          elements.push({ type: "paragraph", paragraph: para });
          paragraphIndex++;
          break;
        }
        case "w:tbl": {
          const table = parseTable(child, {
            warnings: ctx.warnings,
            paragraphIndex,
            options: ctx.options,
            stats: ctx.stats,
          });
          elements.push({ type: "table", table });
          break;
        }
        case "w:sdt": {
          const sdtContent = getChild(child, "w:sdtContent");
          if (sdtContent) {
            const innerElements = walkBody(sdtContent, ctx, depth + 1);
            elements.push(...innerElements);
          }
          break;
        }
        case "w:txbxContent": {
          const innerElements = walkBody(child, ctx, depth + 1);
          elements.push(...innerElements);
          break;
        }
      }
    }
  }

  return elements;
}
